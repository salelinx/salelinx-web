import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";
import {
  acceptLanguageMatches,
  hasLocalePrefix,
  localeFromCountry,
} from "@/lib/i18n/geo";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Local preview of geo-dependent rendering (currency on the pricing page,
  // locale prediction). Vercel sets x-vercel-ip-country in production; there
  // is no such header locally, so `?country=US` stands in for it. Gated to
  // development: in production the header is set by the platform ahead of
  // this code and a query param must never be able to forge it.
  if (process.env.NODE_ENV === "development") {
    const devCountry = request.nextUrl.searchParams.get("country");
    if (devCountry) {
      request.headers.set("x-vercel-ip-country", devCountry.toUpperCase());
    }
  }

  // Supabase reports auth link failures by redirecting to the Site URL with
  // ?error=...&error_code=... (it also repeats them in the hash, which the
  // server cannot see). Nothing read these, so an expired or already-consumed
  // link just rendered the homepage and looked like the site was broken.
  // Forward them to a page that explains what happened and offers a new link.
  const errorCode = request.nextUrl.searchParams.get("error_code");
  if (errorCode && !pathname.startsWith("/auth/link-error")) {
    const target = request.nextUrl.clone();
    target.pathname = "/auth/link-error";
    target.searchParams.delete("error");
    return NextResponse.redirect(target);
  }

  // Paths that must NOT be locale-prefixed by intlMiddleware but STILL need the
  // Supabase cookie refresh below: auth route handlers (outside [locale]), the
  // referral share-link handler, and the top-level, non-localized /admin
  // console tree.
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const skipIntl =
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/signout") ||
    pathname === "/r" ||
    pathname.startsWith("/r/") ||
    isAdminPath;

  // Language prediction. next-intl already picks a locale from the NEXT_LOCALE
  // cookie and then Accept-Language, which is the better signal: it is the
  // language the visitor actually chose in their browser. This only covers the
  // gap - somebody in France or Spain whose browser asks for a language we
  // don't publish - by falling back to the country Vercel geolocates them to.
  // A previous explicit choice always wins, because the cookie is checked
  // first and set as soon as anyone uses the language switcher.
  if (
    !skipIntl &&
    !hasLocalePrefix(pathname) &&
    !request.cookies.get(LOCALE_COOKIE_NAME) &&
    !acceptLanguageMatches(request.headers.get("accept-language"))
  ) {
    const predicted = localeFromCountry(
      request.headers.get("x-vercel-ip-country"),
    );
    if (predicted) {
      const target = request.nextUrl.clone();
      target.pathname = `/${predicted}${pathname === "/" ? "" : pathname}`;
      return NextResponse.redirect(target);
    }
  }

  let response = skipIntl
    ? NextResponse.next({ request })
    : intlMiddleware(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (entries: CookieEntry[]) => {
          entries.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          const next = skipIntl
            ? NextResponse.next({ request })
            : intlMiddleware(request);
          // Carry over ONLY cookies from the previous response. Copying all
          // headers would duplicate intlMiddleware's x-middleware-rewrite /
          // Location headers, which corrupts the rewrite target and 404s "/".
          response.cookies.getAll().forEach((c) => next.cookies.set(c));
          response = next;
          entries.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims verifies the JWT locally against the project's asymmetric
  // (ES256) signing keys via a cached JWKS, instead of getUser()'s network
  // round-trip to the Auth server on EVERY request. It still reads the token
  // through the cookie adapter above, so near-expiry sessions get refreshed
  // and re-set exactly as before. Do not swap this back to getUser(): that
  // adds a blocking Supabase call to every page view. The claims are only
  // used for routing here; RLS remains the real data boundary.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  // Referral claim. This lives here, not in /auth/callback, because signup
  // verification never passes through the callback: /auth/confirm verifies
  // client-side via verifyOtp and skips the callback hop entirely. Claiming
  // on "signed-in request carrying the referral cookie" catches every auth
  // path. The RPC self-guards (self-referral, 48h account age, duplicates,
  // bad code) and returns false instead of raising, so this can never break
  // a request; the cookie is cleared after one attempt either way.
  const refCode = request.cookies.get("slx_ref")?.value;
  if (claims && refCode) {
    try {
      await supabase.rpc("claim_referral", { p_code: refCode });
    } catch {
      // never fail the request over a referral
    }
    response.cookies.set("slx_ref", "", { maxAge: 0, path: "/" });
  }

  // Legacy cleanup: builds up to May 2026 wrote a `theme` cookie that nothing
  // ever read (ThemeToggle was dropped in 99b4e2e and deleted in Sep 2026).
  // Expire it on the first request that still carries it. It had a 1-year
  // max-age, so this block can be deleted after Sep 2027.
  if (request.cookies.get("theme")) {
    response.cookies.set("theme", "", { maxAge: 0, path: "/" });
  }

  // Layer 1 of the admin gate (see docs/ADMIN.md): block non-admins before any
  // admin route code runs. Fail-closed - any error denies. RLS is still the
  // real boundary; this is defense in depth + a clean redirect for humans.
  if (isAdminPath) {
    try {
      if (!claims) {
        return NextResponse.redirect(new URL("/auth/login", request.url));
      }
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", claims.sub)
        .maybeSingle();
      if (!adminRow) {
        return NextResponse.redirect(new URL("/account", request.url));
      }
      // Admin sessions must be AAL2 (password + authenticator code). The
      // membership check above deliberately uses the self-read policy, which
      // works at AAL1, so we can still tell admins apart and route them to
      // the challenge page instead of bouncing them to /account. is_admin()
      // in Postgres enforces the same requirement at the data layer
      // (migration 009), so this gate is UX, not the boundary.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") {
        const challenge = new URL("/auth/mfa", request.url);
        challenge.searchParams.set("next", pathname);
        return NextResponse.redirect(challenge);
      }
    } catch {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  return response;
}

export const config = {
  // robots.txt and sitemap.xml are served by app/robots.ts and app/sitemap.ts
  // OUTSIDE the [locale] tree. They must be excluded here: intlMiddleware
  // would locale-rewrite them into [locale]/[...rest], which 404s them with
  // an HTML error page instead of their content.
  // Static assets are also excluded by extension: without the json entry,
  // fetches of /docs/search-index.<locale>.json ran the full middleware
  // (intl + Supabase auth) for a file that never varies per user.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|webmanifest)$).*)",
  ],
};
