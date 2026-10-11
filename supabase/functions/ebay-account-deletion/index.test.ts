import { assert } from 'jsr:@std/assert@1';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { ebayPublicKey } from './index.ts';
import { createVerify } from 'node:crypto';

Deno.test('reads eBay public key with armour and body run together', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const runTogether = pem.replace(/\n/g, '');
  const payload = JSON.stringify({ notification: { data: { userId: 'u1' } } });
  const signature = createSign('sha1').update(payload).sign(privateKey, 'base64');
  assert(createVerify('sha1').update(payload).verify(ebayPublicKey(runTogether), signature, 'base64'));
});
