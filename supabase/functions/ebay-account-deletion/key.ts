// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createPublicKey, type KeyObject } from 'node:crypto';
import { Buffer } from 'node:buffer';

/** eBay returns the PEM with its armour and body run together, which the PEM parser refuses, so load the DER bytes. */
export function ebayPublicKey(key: string): KeyObject {
  const body = key.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  return createPublicKey({ key: Buffer.from(body, 'base64'), format: 'der', type: 'spki' });
}
