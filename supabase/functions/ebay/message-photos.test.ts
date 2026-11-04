// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { EbayError } from './trading.ts';
import {
  countMessagePhoto,
  decodeMessagePhoto,
  isEbayPhotoUrl,
  PHOTOS_PER_HOUR,
} from './message-photos.ts';

const dataUrl = (bytes: number[], declared = 'image/jpeg') =>
  `data:${declared};base64,${btoa(String.fromCharCode(...bytes))}`;
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1];
const text = (s: string) => [...new TextEncoder().encode(s)];

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return [err.code, err.status];
  }
  return null;
};

Deno.test('a JPEG goes up as a JPEG', () => {
  const photo = decodeMessagePhoto(dataUrl(JPEG));
  assertEquals(photo.type, 'image/jpeg');
  assertEquals(photo.size, JPEG.length);
});

Deno.test('anything else is refused, whatever it claims to be', () => {
  const svg = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const html = text('<html><script>alert(1)</script></html>');
  for (const bad of [
    dataUrl(svg, 'image/svg+xml'),
    dataUrl(svg),
    dataUrl(html),
    dataUrl(PNG, 'image/png'),
    dataUrl(PNG),
    dataUrl(WEBP),
    dataUrl([0x4d, 0x5a, 0x90, 0x00]),
    // A JPEG calling itself something else, which the panel never sends.
    dataUrl(JPEG, 'image/webp'),
    dataUrl([]),
  ]) {
    assertEquals(
      code(() => decodeMessagePhoto(bad)),
      ['bad_request', 400],
    );
  }
});

Deno.test('what is not a data URL is refused', () => {
  for (const bad of [
    undefined,
    null,
    42,
    {},
    '',
    'hello',
    'https://example.com/a.jpg',
    'data:text/html;base64,PGh0bWw+',
    'data:image/jpeg,not-base64',
    'data:image/jpeg;base64,***',
  ]) {
    assertEquals(code(() => decodeMessagePhoto(bad))?.[0], 'bad_request');
  }
});

Deno.test('an oversized photo is refused before it is decoded', () => {
  const realAtob = globalThis.atob;
  let decoded = false;
  globalThis.atob = (s) => {
    decoded = true;
    return realAtob(s);
  };
  try {
    assertEquals(
      code(() => decodeMessagePhoto(`data:image/jpeg;base64,${'A'.repeat(5)}`, 3)),
      ['bad_request', 413],
    );
    assertEquals(decoded, false);
    // Exactly at the limit is fine.
    assertEquals(decodeMessagePhoto(dataUrl([0xff, 0xd8, 0xff]), 3).size, 3);
  } finally {
    globalThis.atob = realAtob;
  }
});

Deno.test('only eBay picture addresses count', () => {
  for (const good of [
    'https://i.ebayimg.com/images/g/abc/s-l1600.jpg',
    'https://i.ebayimg.com/00/s/MTYwMA==/z/abc/$_57.JPG?set_id=8800005007',
    'https://i.ebayimg.sandbox.ebay.com/images/g/abc/s-l1600.jpg',
  ]) {
    assertEquals(isEbayPhotoUrl(good), true, good);
  }
  for (const bad of [
    undefined,
    42,
    '',
    'not a url',
    'http://i.ebayimg.com/a.jpg',
    'javascript:alert(1)',
    'data:image/jpeg;base64,AAAA',
    'https://evil.example/a.jpg',
    // eBay's name in the wrong place.
    'https://ebayimg.com.evil.example/a.jpg',
    'https://notebayimg.com/a.jpg',
    'https://evil.example/i.ebayimg.com/a.jpg',
    'https://i.ebayimg.com@evil.example/a.jpg',
    'https://user:pw@i.ebayimg.com/a.jpg',
    'https://i.ebayimg.com:8443/a.jpg',
    `https://i.ebayimg.com/${'x'.repeat(200)}`,
  ]) {
    assertEquals(isEbayPhotoUrl(bad), false, String(bad));
  }
});

/** A seller who has sent hourCount photos this hour, or none yet when null. */
const seller = (hourCount: number | null, errors: { read?: unknown; count?: unknown } = {}) => {
  const read = {};
  const counted = [];
  return {
    read,
    counted,
    from: (table) => {
      read.table = table;
      const query = {
        select: () => query,
        eq: (column, value) => {
          read[column] = value;
          return query;
        },
        maybeSingle: async () => ({
          data: hourCount === null ? null : { count: hourCount },
          error: errors.read ?? null,
        }),
      };
      return query;
    },
    rpc: async (name, args) => {
      counted.push([name, args]);
      return { data: 1, error: errors.count ?? null };
    },
  };
};
const LATE = new Date('2026-11-04T23:59:00Z');

Deno.test(
  'under the limit a photo goes up, read by the hour and counted under the month',
  async () => {
    const client = seller(PHOTOS_PER_HOUR - 1);
    await countMessagePhoto(client, 'u1', LATE);
    assertEquals(client.read, {
      table: 'usage_counters',
      user_id: 'u1',
      feature: 'ebay_message_photos',
      period_key: '2026-11-04T23',
    });
    assertEquals(client.counted, [
      ['increment_usage_counter', { p_feature: 'ebay_message_photos', p_period_key: '2026-11' }],
    ]);
  },
);

Deno.test('the key it counts under is one the database takes', async () => {
  const client = seller(0);
  await countMessagePhoto(client, 'u1', LATE);
  const key = client.counted[0][1].p_period_key;
  // Both from increment_usage_counter: it refuses a caller naming an hour.
  assertEquals(/^[A-Za-z0-9_-]{1,32}$/.test(key), true);
  assertEquals(/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key), false);
});

Deno.test('the first photo of an hour has no row yet, and goes up', async () => {
  const client = seller(null);
  await countMessagePhoto(client, 'u1', LATE);
  assertEquals(client.counted.length, 1);
});

Deno.test(
  'at the limit it is refused in a way the extension can name, and writes nothing',
  async () => {
    const client = seller(PHOTOS_PER_HOUR);
    const err = await assertRejects(() => countMessagePhoto(client, 'u1', LATE), EbayError);
    assertEquals([err.code, err.status], ['rate_limited', 429]);
    assertEquals(client.counted, []);
  },
);

Deno.test('no check means no upload', async () => {
  const realError = console.error;
  console.error = () => {};
  try {
    for (const errors of [{ read: { message: 'down' } }, { count: { message: 'down' } }]) {
      const err = await assertRejects(
        () => countMessagePhoto(seller(0, errors), 'u1', LATE),
        EbayError,
      );
      assertEquals([err.code, err.status], ['unavailable', 500]);
    }
  } finally {
    console.error = realError;
  }
});
