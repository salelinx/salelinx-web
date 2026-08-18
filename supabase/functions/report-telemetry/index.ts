// deno-lint-ignore-file
// Deployed to Supabase Edge Functions. Runs in Deno, not Node.
//
// Receives batched endpoint-health counters from the extension. The extension
// aggregates locally all day (see src/utils/telemetry/ in the extension repo)
// and POSTs one batch, so this is a low-volume endpoint: roughly one request
// per install per day, each carrying a few dozen counter rows.
//
// AUTH: the caller sends the user's Supabase JWT in Authorization, validated
// with getUser(jwt) - the same pattern as send-shipping-labels. This is only
// used to prove the caller is a real signed-in user, as a spam gate. The user
// id is deliberately NOT stored: see the header comment on migration 029 for
// why endpoint_health is anonymous. Anonymous data, authenticated transport.
//
// verify_jwt = false at the gateway (Supabase cannot verify our ES256 tokens),
// so the handler does the validation itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// A batch is one install's day. 500 counter rows is far above the ~54 distinct
// endpoints x 7 outcomes an honest client can produce, so it bounds abuse
// without ever clipping a real report.
const MAX_ENTRIES = 500;
const MAX_BODY_BYTES = 256 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  // Reject oversized bodies before parsing rather than after.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return json({ error: "payload too large" }, 413);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json({ error: "missing authorization" }, 401);
  }

  // Validate the caller is a real user. The returned identity is intentionally
  // discarded - we need "is a signed-in user", not "which user".
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json({ error: "invalid token" }, 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const entries = (payload as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    return json({ error: "entries must be an array" }, 400);
  }
  if (entries.length === 0) {
    return json({ inserted: 0 });
  }
  if (entries.length > MAX_ENTRIES) {
    return json({ error: "too many entries" }, 413);
  }

  // The RPC re-validates every field and silently drops bad rows, so this pass
  // only strips unexpected keys - it must never be the only line of defense.
  const cleaned = entries.map((e) => {
    const entry = e as Record<string, unknown>;
    return {
      endpoint_key: entry.endpoint_key,
      platform: entry.platform,
      outcome: entry.outcome,
      status_code: entry.status_code ?? null,
      count: entry.count,
      extension_version: entry.extension_version,
      bucket_hour: entry.bucket_hour,
    };
  });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc("record_endpoint_health", {
    p_batch: cleaned,
  });

  if (error) {
    // No user id, no endpoint payload in the log - just the failure reason.
    console.error("record_endpoint_health failed:", error.message);
    return json({ error: "insert failed" }, 500);
  }

  return json({ inserted: data ?? 0 });
});
