// deno-lint-ignore-file
// Deployed to Supabase Edge Functions. Runs in Deno, not Node.
//
// Receives one admin endpoint self-test run from the extension (see
// src/utils/telemetry/selftest-* in the extension repo) and stores it via
// record_selftest_run (012_endpoint_selftest.sql).
//
// AUTH, and how it differs from report-telemetry:
//
// report-telemetry validates the JWT purely as a spam gate and then THROWS THE
// IDENTITY AWAY, because endpoint_health is deliberately anonymous. This
// function does the opposite: the identity is the point, since a run history
// with no runner attached is not an audit trail. So the user id is validated
// and stored.
//
// That makes the admin check a real security boundary rather than a UI
// nicety. The extension's own isCurrentUserAdmin() is a bare admin_users
// lookup on the client - fine for deciding whether to show a panel section,
// worthless as authorisation, since a client can simply claim to be an admin.
// So membership is re-checked HERE with the service role, against the id from
// the verified JWT, and again inside record_selftest_run.
//
// Why not is_admin(): that requires AAL2 (003_support.sql), which means a TOTP
// challenge. The extension has no MFA flow and cannot mint an aal2 session, so
// gating on it would make this permanently uncallable. The compensating
// control is that this function can ONLY write self-test rows - it exposes no
// read path and no destructive action, so a non-MFA admin session cannot use
// it to reach admin data. Read access to these rows still goes through
// admin_selftest_runs(), which does require AAL2.
//
// verify_jwt = false at the gateway (Supabase cannot verify our ES256 tokens),
// so the handler does the validation itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/security.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// One run covers ~22 endpoints on the larger platform. 200 bounds abuse
// without ever clipping a real run.
const MAX_RESULTS = 200;
const MAX_BODY_BYTES = 128 * 1024;

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

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return json({ error: "payload too large" }, 413);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json({ error: "missing authorization" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json({ error: "invalid token" }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // The authorisation boundary. Checked against the id from the VERIFIED JWT,
  // never against anything the client sent in the body.
  const { data: adminRow, error: adminErr } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminErr) {
    console.error("admin lookup failed:", adminErr.message);
    return json({ error: "auth check failed" }, 500);
  }
  if (!adminRow) {
    // Deliberately 403 and not 404: the caller is authenticated, just not
    // permitted. No user id in the log.
    return json({ error: "forbidden" }, 403);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const results = body.results;

  if (!Array.isArray(results)) {
    return json({ error: "results must be an array" }, 400);
  }
  if (results.length === 0) {
    return json({ error: "empty run" }, 400);
  }
  if (results.length > MAX_RESULTS) {
    return json({ error: "too many results" }, 413);
  }
  if (body.platform !== "vinted" && body.platform !== "depop") {
    return json({ error: "invalid platform" }, 400);
  }

  // Strip unexpected keys. The RPC re-validates every field and drops bad
  // rows, so this must never be the only line of defence.
  const cleaned = results.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    return {
      endpoint_key: row.endpoint_key,
      outcome: row.outcome,
      status_code: row.status_code ?? null,
      duration_ms: row.duration_ms ?? null,
      note: row.note ?? null,
    };
  });

  const { data, error } = await admin.rpc("record_selftest_run", {
    p_run_by: userId,
    p_extension_version: String(body.extension_version ?? "unknown"),
    p_platform: body.platform,
    p_included_throwaway: body.included_throwaway === true,
    p_started_at: body.started_at ?? new Date().toISOString(),
    p_finished_at: body.finished_at ?? new Date().toISOString(),
    p_results: cleaned,
  });

  if (error) {
    console.error("record_selftest_run failed:", error.message);
    return json({ error: "insert failed" }, 500);
  }

  const result = (data ?? {}) as { ok?: boolean; run_id?: string; inserted?: number };
  if (!result.ok) {
    return json({ error: "rejected" }, 400);
  }

  return json({ ok: true, run_id: result.run_id, inserted: result.inserted ?? 0 });
});
