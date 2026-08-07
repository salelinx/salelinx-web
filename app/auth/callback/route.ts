import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";
  const refCode = request.cookies.get("slx_ref")?.value;

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // A failed exchange used to fall through and redirect anyway, dropping the
    // user on a page that needs a session without one. The reset form then
    // failed on submit with an unrelated-looking message.
    if (error) {
      const target = new URL("/auth/link-error", url.origin);
      target.searchParams.set("error_code", "exchange_failed");
      target.searchParams.set("error_description", error.message);
      return NextResponse.redirect(target);
    }

    // First moment a verified session exists: claim any referral cookie set
    // by /r/CODE. The RPC self-guards (self-referral, account age, duplicate,
    // bad code) and returns false instead of raising, so a failed claim can
    // never break sign-in. The callback also fires for password reset and
    // email change; the RPC's guards make those replays harmless.
    if (refCode) {
      try {
        await supabase.rpc("claim_referral", { p_code: refCode });
      } catch {
        // never break the auth flow over a referral
      }
    }
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  if (refCode) {
    response.cookies.set("slx_ref", "", { maxAge: 0, path: "/" });
  }
  return response;
}
