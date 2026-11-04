// What a reply's photo has to be before it goes anywhere near eBay, and how fast a
// seller can send them. The extension checks photos too, but anyone signed in can
// call this function without it.
//
// Never logs a photo: bytes and addresses stay out of the logs (docs/GDPR.md).

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { EbayError } from './trading.ts';

/** The extension redraws each photo as a JPEG up to 1600px, which comes nowhere near this. */
const MAX_BYTES = 5 * 1024 * 1024;
/** An abuse limit, not an allowance: 20 replies an hour with all five photos is beyond anyone replying
 *  by hand. There is deliberately no daily cap. */
export const PHOTOS_PER_HOUR = 100;
const COUNTER = 'ebay_message_photos';
const JPEG_PREFIX = 'data:image/jpeg;base64,';
const MAX_URL_CHARS = 200;

/** The size is checked before decoding, so an oversized request costs next to nothing. The type comes
 *  from the first bytes, as a data URL can say anything about itself. */
export function decodeMessagePhoto(dataUrl: unknown, maxBytes: number = MAX_BYTES): Blob {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(JPEG_PREFIX)) {
    throw new EbayError('Expected a JPEG data URL', 'bad_request');
  }
  const encoded = dataUrl.slice(JPEG_PREFIX.length);
  if (encoded.length > Math.ceil(maxBytes / 3) * 4) {
    throw new EbayError('Photo is too large', 'bad_request', 413);
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(encoded), (ch) => ch.charCodeAt(0));
  } catch {
    throw new EbayError('Expected a JPEG data URL', 'bad_request');
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new EbayError('Only JPEG photos are accepted', 'bad_request');
  }
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** One of eBay's own picture addresses, by its real host: not just text that contains the name. */
export function isEbayPhotoUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > MAX_URL_CHARS) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      /(^|\.)ebayimg\.com$|^i\.ebayimg\.sandbox\.ebay\.com$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

/** For saying which host was refused, and nothing else about the address. */
export function photoHostOf(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return 'not an address';
  }
}

/** Refuses a seller going faster than the limit, then counts this photo. Through the user-scoped
 *  client, so the own-read policy and auth.uid() mean it only ever sees and counts the caller.
 *
 *  increment_usage_counter keeps an hour row for every counter by itself ('YYYY-MM-DDTHH', UTC) and
 *  refuses a caller naming one, so this reads that row and counts under the month. A key of its own per
 *  hour wouldn't do: those rows count towards the 2,000 the function allows a user, and reaching that
 *  stops every counter they have. Refuses if it can't check, as the other limits do. */
export async function countMessagePhoto(
  userScoped,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const stamp = now.toISOString();
  const { data: hour, error: readError } = await userScoped
    .from('usage_counters')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', COUNTER)
    .eq('period_key', stamp.slice(0, 13))
    .maybeSingle();
  if (readError) {
    console.error('[ebay] reply photo limit read failed:', readError.message);
    throw new EbayError('Photo limit check failed', 'unavailable', 500);
  }
  // Refused before the count, so a script past the limit writes nothing more.
  if ((hour?.count ?? 0) >= PHOTOS_PER_HOUR) {
    throw new EbayError('Too many photos in a short time, try again later', 'rate_limited', 429);
  }
  const { error: countError } = await userScoped.rpc('increment_usage_counter', {
    p_feature: COUNTER,
    p_period_key: stamp.slice(0, 7),
  });
  if (countError) {
    console.error('[ebay] reply photo counter failed:', countError.message);
    throw new EbayError('Photo limit check failed', 'unavailable', 500);
  }
}
