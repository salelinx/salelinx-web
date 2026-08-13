import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Expired or already-used link. Redirecting onward regardless would land
      // the user on a page with no session, where the next action fails with a
      // cryptic "Auth session missing" instead of "request a new link".
      const failed = new URL("/auth/login", url.origin);
      failed.searchParams.set("error", "link_invalid");
      return NextResponse.redirect(failed);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
