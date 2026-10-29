const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 암호학적으로 안전한 무작위 토큰(base64url) */
export function randomToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function aesKey(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64Url(base64Key), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/** AES-256-GCM 암호화. 키는 base64로 표현한 32바이트, 결과는 `iv.암호문`(base64url) */
export async function encryptAesGcm(base64Key: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(base64Key),
    encoder.encode(plaintext),
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

export async function decryptAesGcm(base64Key: string, payload: string): Promise<string> {
  const [iv, cipher] = payload.split('.');
  if (!iv || !cipher) throw new Error('암호문 형식이 올바르지 않습니다');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) },
    await aesKey(base64Key),
    fromBase64Url(cipher),
  );
  return new TextDecoder().decode(plain);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** HMAC-SHA256 서명을 base64url로 돌려준다 */
export async function hmacSign(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(message),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** 서명 검증. 상수 시간 비교는 `subtle.verify`가 맡는다 */
export async function hmacVerify(
  secret: string,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(message),
    );
  } catch {
    return false;
  }
}
