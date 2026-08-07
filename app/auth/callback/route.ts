import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";

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
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
