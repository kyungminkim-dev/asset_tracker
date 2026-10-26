import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config.js';

// 증권사 API 키 등 민감 정보는 AES-256-GCM 으로 암호화해 DB에 저장한다.
const key = Buffer.from(config.encryptionKey, 'base64');
if (key.length !== 32) throw new Error('ENCRYPTION_KEY 는 32바이트 base64 여야 합니다. (npm run gen-key)');

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  if (!iv || !tag || !data) throw new Error('암호화된 값의 형식이 올바르지 않습니다.');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export const encryptJson = (value: unknown) => encrypt(JSON.stringify(value));
export const decryptJson = <T>(payload: string) => JSON.parse(decrypt(payload)) as T;
