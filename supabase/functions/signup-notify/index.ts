import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyPayment } from "../_shared/payment-notify.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FRESH_MS = 5 * 60_000;

Deno.serve(async (req) => {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return new Response(null, { status: 400 });

  const { data } = await admin.auth.admin.getUserById(id);
  const user = data?.user;
  // No secret on this endpoint: a caller can only re-announce an account created in the last few minutes.
  if (!user || Date.now() - Date.parse(user.created_at) > FRESH_MS) {
    return new Response(null, { status: 204 });
  }

  await notifyPayment({
    event: "New signup",
    email: user.email,
    note: user.app_metadata?.provider ?? null,
  });
  return new Response(null, { status: 204 });
});
