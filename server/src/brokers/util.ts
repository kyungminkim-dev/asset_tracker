import { decrypt, encrypt } from '../crypto.js';
import type { Db } from '../db.js';
import { BrokerApiError } from './types.js';

export async function requestJson(
  brokerId: string,
  url: string,
  init: RequestInit = {},
): Promise<{ body: any; headers: Headers }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new BrokerApiError(brokerId, `요청 실패: ${(err as Error).message}`);
  }
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // JSON 이 아닌 응답은 문자열 그대로 둔다
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.msg1 ?? body?.error_description ?? text.slice(0, 200);
    throw new BrokerApiError(brokerId, `HTTP ${res.status}: ${msg}`, res.status);
  }
  return { body, headers: res.headers };
}

/** "1,234.5" / 1234.5 / { amount: 1234.5 } 같은 값을 숫자로 */
export function num(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'amount' in value) return num((value as { amount: unknown }).amount);
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export const tokenCacheKey = (connectionId: string) => `token:${connectionId}`;

/**
 * 접근 토큰 캐시. 증권사들은 토큰 발급 횟수를 제한하므로(예: 한국투자증권 1분 1회)
 * 서버 재시작 후에도 재사용할 수 있게 DB에 암호화해 둔다.
 */
export async function cachedToken(
  db: Db,
  connectionId: string,
  issue: () => Promise<{ token: string; expiresInSec: number }>,
): Promise<string> {
  // 키 이름에 API 키 같은 민감 정보를 넣지 않고 연결 id 로 구분한다 (연결 해제 시 함께 삭제)
  const key = tokenCacheKey(connectionId);
  const row = db.prepare('SELECT value, expires_at FROM kv WHERE key = ?').get(key) as
    | { value: string; expires_at: number }
    | undefined;
  // 만료 10분 전부터는 새로 발급
  if (row && row.expires_at - 10 * 60_000 > Date.now()) return decrypt(row.value);

  const { token, expiresInSec } = await issue();
  db.prepare('INSERT OR REPLACE INTO kv (key, value, expires_at) VALUES (?, ?, ?)').run(
    key,
    encrypt(token),
    Date.now() + expiresInSec * 1000,
  );
  return token;
}
