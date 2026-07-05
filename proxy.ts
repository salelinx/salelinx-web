import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Paths that must NOT be locale-prefixed by intlMiddleware but STILL need the
  // Supabase cookie refresh below: auth route handlers (outside [locale]) and
  // the top-level, non-localized /admin console tree.
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const skipIntl =
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/signout") ||
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)$).*)",
  ],
};
