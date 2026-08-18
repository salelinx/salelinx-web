import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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
