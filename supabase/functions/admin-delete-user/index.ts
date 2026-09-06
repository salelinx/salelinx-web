// deno-lint-ignore-file
// admin-delete-user: full account deletion from the admin console
// (/admin/users detail drawer). Runs the SAME steps as the GDPR erasure
// runbook script (scripts/delete-user-account.mjs, docs/GDPR.md):
//
//   1. Storage objects under listing-images/{userId}/ (DB cascade does not
//      touch Storage)
//   2. The Stripe customer(s) - deletion cancels any active subscription;
//      Stripe retains invoices for tax law, which the privacy policy discloses
//   3. The auth.users row - ON DELETE CASCADE then removes listings,
//      platform_credentials, user_settings, linked_accounts, subscriptions,
//      usage_counters, user_storage, support_tickets, and replies
//
// Manual follow-ups still apply (the function cannot reach them): purge the
// user's threads from the support@salelinx.com inbox.
//
// Auth: verify_jwt = false at the gateway (ES256, same as the other authed
// functions); the handler validates the caller via getUser() and then gates
// on admin_users membership via the service role. Guards: admins cannot
// delete themselves, and cannot delete another admin (revoke admin first via
// the dashboard; also, admin_audit_log.actor_id has a plain FK to auth.users,
// so deleting an actor would fail anyway).
//
// Body: { userId: <target user uuid> }

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "listing-images";

import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Read the aal claim from a JWT that getUser() has ALREADY validated (never
// call this on an unverified token). base64url -> base64 padding for atob.
function jwtAal(authHeader: string): string {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)).aal ?? "";
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user)
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  // Admin sessions must be AAL2 (password + authenticator code), mirroring
  // is_admin() in Postgres (003_support.sql). A stolen JWT without the second
  // factor cannot delete accounts.
  if (jwtAal(authHeader) !== "aal2") {
    return json({ error: "mfa_required" }, 403);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: adminRow, error: adminErr } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminErr || !adminRow)
    return new Response("Forbidden", { status: 403, headers: corsHeaders });

  let userId: unknown;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ error: "missing_params" }, 400);
  }
  if (typeof userId !== "string" || !userId) {
    return json({ error: "missing_params" }, 400);
  }
  if (userId === user.id) return json({ error: "cannot_delete_self" }, 400);

  const { data: targetAdmin } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (targetAdmin) return json({ error: "target_is_admin" }, 400);

  const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(
    userId,
  );
  if (getErr || !targetUser?.user) return json({ error: "no_such_user" }, 404);

  // 1. Storage objects (mirrors the runbook script: the usual layout is
  // {userId}/{listingId}/{file}, with a fallback for files directly under the
  // user folder). DB cascade does not touch Storage.
  const paths: string[] = [];
  const { data: folders, error: listErr } = await admin.storage
    .from(BUCKET)
    .list(userId, { limit: 1000 });
  if (listErr) return json({ error: `storage list: ${listErr.message}` }, 500);
  for (const entry of folders ?? []) {
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    const { data: files, error: fileErr } = await admin.storage
      .from(BUCKET)
      .list(`${userId}/${entry.name}`, { limit: 1000 });
    if (fileErr)
      return json({ error: `storage list: ${fileErr.message}` }, 500);
    for (const f of files ?? []) paths.push(`${userId}/${entry.name}/${f.name}`);
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error: rmErr } = await admin.storage
      .from(BUCKET)
      .remove(paths.slice(i, i + 100));
    if (rmErr) return json({ error: `storage remove: ${rmErr.message}` }, 500);
  }

  // 2. Stripe customers. Deleting a customer cancels its subscriptions;
  // invoices survive (retained for tax law). A user can in principle have
  // rows pointing at more than one customer id, so delete each distinct one.
  const { data: subs } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId);
  const customerIds = Array.from(
    new Set(
      (subs ?? [])
        .map((s) => s.stripe_customer_id as string | null)
        .filter((id): id is string => !!id),
    ),
  );
  let stripeDeleted = 0;
  if (customerIds.length > 0) {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-02-24.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });
    for (const id of customerIds) {
      try {
        await stripe.customers.del(id);
        stripeDeleted += 1;
      } catch (err) {
        // Already-deleted customers are fine; anything else must abort so we
        // never delete the account while Stripe could still charge them.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("No such customer")) {
          return json({ error: `stripe: ${msg}` }, 500);
        }
      }
    }
  }

  // 3. The auth user - cascades every user-owned row.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: `deleteUser: ${delErr.message}` }, 500);

  // Audit AFTER success, with the verified caller as actor. Per docs/GDPR.md
  // the entry must not reference the erased user: no user id in target_id or
  // metadata, counts only. This entry is the record that an erasure happened.
  const { error: auditErr } = await admin.from("admin_audit_log").insert({
    actor_id: user.id,
    action: "user.delete",
    target_table: "auth.users",
    target_id: null,
    metadata: {
      storage_objects: paths.length,
      stripe_customers: stripeDeleted,
      account_created_at: targetUser.user.created_at,
    },
  });
  if (auditErr) console.error("audit insert failed:", auditErr.message);

  return json({
    ok: true,
    storage_objects: paths.length,
    stripe_customers: stripeDeleted,
  });
});
