// deno-lint-ignore-file
// delete-account: self-serve account deletion from the account page
// (/account Danger zone). Runs the SAME steps as the GDPR erasure runbook
// (admin-delete-user, scripts/delete-user-account.mjs, docs/GDPR.md), but the
// target is always the caller themselves:
//
//   1. Storage objects under listing-images/{userId}/ (DB cascade does not
//      touch Storage)
//   2. The Stripe customer(s) - deletion cancels any active subscription;
//      Stripe retains invoices for tax law, which the privacy policy discloses
//   3. The auth.users row - ON DELETE CASCADE then removes listings,
//      platform_credentials, user_settings, linked_accounts, subscriptions,
//      usage_counters, user_storage, support_tickets, replies, and referral
//      rows
//
// Unlike admin-delete-user there is NO admin_audit_log entry: actor_id is a
// NOT NULL FK to auth.users, so a self-deleting user cannot be the actor of
// a row that outlives them, and a self-delete is not an admin action anyway.
// Counts are logged (no PII; user UUIDs are the ceiling, see docs/GDPR.md).
//
// Guard: admins cannot self-delete here (their admin_audit_log entries hold
// a plain FK to auth.users, so the delete would fail mid-runbook; revoke
// admin first, then use the admin console or the script).
//
// Auth: verify_jwt = false at the gateway (ES256, same as the other authed
// functions); the handler validates the caller via getUser(). The UI adds a
// client-side password recheck before calling, same pattern as the admin
// console's step-up reauth.
//
// Body: none required.

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "listing-images";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  const userId = user.id;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: adminRow, error: adminErr } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminErr) return json({ error: "admin_check_failed" }, 500);
  if (adminRow) return json({ error: "admin_account" }, 400);

  // 1. Storage objects (mirrors admin-delete-user: the usual layout is
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

  console.log(
    `self-delete complete: ${paths.length} storage objects, ${stripeDeleted} stripe customers`,
  );

  return json({
    ok: true,
    storage_objects: paths.length,
    stripe_customers: stripeDeleted,
  });
});
