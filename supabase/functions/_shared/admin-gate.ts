// The admin gate the admin-* functions run inline: getUser() validates the
// JWT, the session must be AAL2 (as is_admin() requires), and admin_users
// membership is read with the service role. Returns the admin's user id, or the
// Response to send instead.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

export async function requireAdmin(
  req: Request,
  admin: SupabaseClient,
  headers: Record<string, string>,
): Promise<string | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response("Unauthorized", { status: 401, headers });
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers });
  // jwtAal reads a token getUser() has just validated.
  if (jwtAal(authHeader) !== "aal2") {
    return new Response(JSON.stringify({ error: "mfa_required" }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  const { data, error } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data)
    return new Response("Forbidden", { status: 403, headers });
  return user.id;
}
