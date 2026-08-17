import { NextResponse } from "next/server";

// Referral share link: /r/CODE sets the attribution cookie and forwards to
// the invite landing page, which explains the deal the referred visitor was
// promised. No DB lookup here - an unknown code fails silently at claim time
// (claim_referral RPC), so this route is not an enumeration oracle.
// Last-touch wins: a second link overwrites the cookie.
//
// Non-localized on purpose (sibling of app/auth/) - proxy.ts lists /r/ in
// its skipIntl allowlist so next-intl does not rewrite it.

const CODE_SHAPE = /^[A-HJ-NP-Z2-9]{8}$/i;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/invited", url.origin));

  if (CODE_SHAPE.test(code)) {
    response.cookies.set("slx_ref", code.toUpperCase(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
