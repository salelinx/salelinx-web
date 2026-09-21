/**
 * Constant-time string compare for shared secrets. Hand-rolled rather than
 * `crypto.timingSafeEqual` so callers stay runtime-agnostic (that needs Node
 * and equal-length buffers). Length is compared first and leaks only the
 * length, which is not the secret.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
