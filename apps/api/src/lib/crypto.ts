const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

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

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
