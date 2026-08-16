import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { routing } from "@/i18n/routing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const localeParam = url.searchParams.get("locale");

  if (code) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // A failed exchange used to fall through and redirect anyway, dropping the
    // user on a page that needs a session without one. The reset form then
    // failed on submit with an unrelated-looking message.
    if (error) {
      const target = new URL("/auth/link-error", url.origin);
      target.searchParams.set("error_code", "exchange_failed");
      target.searchParams.set("error_description", error.message);
      return NextResponse.redirect(target);
    }

    // OAuth sign-ins cannot set user_metadata up front the way the password
    // signup does, so first-time Google users would otherwise have no
    // preferred_locale and get English auth emails. Backfill it once here;
    // never overwrite a value the user already has.
    const preferred = data.user?.user_metadata?.preferred_locale;
    if (
      !preferred &&
      localeParam &&
      (routing.locales as readonly string[]).includes(localeParam)
    ) {
      // Best-effort: a failure here must not break sign-in.
      await supabase.auth
        .updateUser({ data: { preferred_locale: localeParam } })
        .catch(() => {});
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
