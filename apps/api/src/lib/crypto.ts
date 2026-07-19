import { fromBase64Url, toBase64Url } from '@wakeupbabe/shared';

// hmac primitives live in shared so the dashboard gate worker can verify
// sessions; re-exported here so api code keeps one crypto import path
export { hmacSign, hmacVerify } from '@wakeupbabe/shared';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function importAesKey(base64UrlKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64Url(base64UrlKey), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(plaintext: string, base64UrlKey: string): Promise<string> {
  const key = await importAesKey(base64UrlKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(packed);
}

export async function decryptSecret(packedBase64Url: string, base64UrlKey: string): Promise<string> {
  const key = await importAesKey(base64UrlKey);
  const packed = fromBase64Url(packedBase64Url);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return decoder.decode(plaintext);
}
