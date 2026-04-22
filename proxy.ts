import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

const intlMiddleware = createIntlMiddleware(routing);

function passwordGate(request: NextRequest) {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) return null;

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const supplied = decoded.split(":").slice(1).join(":");
    if (supplied === expected) return null;
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SaleLinx"' },
  });
}

export async function proxy(request: NextRequest) {
  const gate = passwordGate(request);
  if (gate) return gate;

  // Skip locale handling for auth route handlers that live outside [locale].
  const pathname = request.nextUrl.pathname;
  const isRouteHandler =
    pathname.startsWith("/auth/callback") || pathname.startsWith("/auth/signout");

  let response = isRouteHandler
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
          const next = isRouteHandler
            ? NextResponse.next({ request })
            : intlMiddleware(request);
          // Preserve headers/cookies/status set by the previous response.
          response.headers.forEach((v, k) => next.headers.append(k, v));
          response.cookies.getAll().forEach((c) => next.cookies.set(c));
          response = next;
          entries.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg)$).*)",
  ],
};
