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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Referral claim. This lives here, not in /auth/callback, because signup
  // verification never passes through the callback: /auth/confirm verifies
  // client-side via verifyOtp and skips the callback hop entirely. Claiming
  // on "signed-in request carrying the referral cookie" catches every auth
  // path. The RPC self-guards (self-referral, 48h account age, duplicates,
  // bad code) and returns false instead of raising, so this can never break
  // a request; the cookie is cleared after one attempt either way.
  const refCode = request.cookies.get("slx_ref")?.value;
  if (user && refCode) {
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
  //
  // TODO(admin-mfa): also require an AAL2 session here once MFA enrolment ships.
  if (isAdminPath) {
    try {
      if (!user) {
        return NextResponse.redirect(new URL("/auth/login", request.url));
      }
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!adminRow) {
        return NextResponse.redirect(new URL("/account", request.url));
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg)$).*)",
  ],
};
