export const DEFAULT_NEXT = "/account";

/**
 * Reduce a caller-supplied post-auth destination to a same-origin path.
 *
 * `new URL(next, origin)` ignores the base whenever `next` is absolute
 * ("https://evil.com") or protocol-relative ("//evil.com"), so passing one
 * through unchecked turns a redirect on our own domain into an open redirect.
 * Backslashes are rejected too, since browsers normalise "/\evil.com" the same
 * way as "//evil.com".
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_NEXT;
  if (!next.startsWith("/")) return DEFAULT_NEXT;
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_NEXT;
  return next;
}
