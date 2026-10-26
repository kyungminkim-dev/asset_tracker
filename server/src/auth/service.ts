import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { transaction, type Db } from '../db.js';
import { tokenCacheKey } from '../brokers/util.js';
import type { OAuthProfile } from './providers.js';

export interface User {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  providers: string[];
}

const STATE_TTL = 10 * 60_000;
const LOGIN_CODE_TTL = 2 * 60_000;

const token = () => randomBytes(32).toString('base64url');
const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAllowedAppRedirect(url: string) {
  return config.appRedirectPrefixes.some((prefix) => url.startsWith(prefix));
}

// --- OAuth state ---

export type AuthMode = 'login' | 'signup';

export function createOAuthState(db: Db, provider: string, appRedirect: string, challenge: string, mode: AuthMode = 'login') {
  db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').run(Date.now());
  const state = token();
  db.prepare('INSERT INTO oauth_states (state, provider, app_redirect, challenge, expires_at, mode) VALUES (?, ?, ?, ?, ?, ?)').run(
    state,
    provider,
    appRedirect,
    challenge,
    Date.now() + STATE_TTL,
    mode,
  );
  return state;
}

/** state 는 한 번만 쓸 수 있다 */
export function consumeOAuthState(db: Db, provider: string, state: string) {
  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state) as
    | { provider: string; app_redirect: string; challenge: string; expires_at: number; mode: AuthMode }
    | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  if (row.provider !== provider || row.expires_at < Date.now()) return null;
  return { appRedirect: row.app_redirect, challenge: row.challenge, mode: row.mode };
}

// --- 사용자 ---

/**
 * 소셜 계정으로 사용자를 찾는다. 가입(signup) 모드에서만 새로 만든다.
 * 이미 가입된 계정으로 가입을 시도하면 그대로 로그인시킨다.
 * 로그인 모드에서 가입되지 않은 계정이면 null.
 */
export function findOrCreateUser(
  db: Db,
  provider: string,
  profile: OAuthProfile,
  mode: AuthMode,
): { userId: string; created: boolean } | null {
  return transaction(db, () => {
    const found = db
      .prepare('SELECT user_id FROM identities WHERE provider = ? AND subject = ?')
      .get(provider, profile.subject) as { user_id: string } | undefined;
    if (found) {
      db.prepare('UPDATE users SET display_name = ?, avatar_url = COALESCE(?, avatar_url), email = COALESCE(?, email) WHERE id = ?').run(
        profile.displayName,
        profile.avatarUrl,
        profile.email,
        found.user_id,
      );
      return { userId: found.user_id, created: false };
    }
    if (mode !== 'signup') return null;

    // 가입 화면에서 필수 약관에 동의해야만 signup 으로 시작할 수 있다 (routes.ts)
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (id, display_name, email, avatar_url, created_at, terms_agreed_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      profile.displayName,
      profile.email,
      profile.avatarUrl,
      now,
      now,
    );
    db.prepare('INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)').run(
      provider,
      profile.subject,
      id,
      profile.email,
      now,
    );
    return { userId: id, created: true };
  });
}

/** 개발·테스트용: 모드와 상관없이 사용자를 찾거나 만든다 */
export function upsertUser(db: Db, provider: string, profile: OAuthProfile): string {
  return findOrCreateUser(db, provider, profile, 'signup')!.userId;
}

/** 로그인이 실패로 끝났음을 기록해, 폴링하는 앱이 이유를 알 수 있게 한다 */
export function recordLoginFailure(db: Db, challenge: string, error: string) {
  db.prepare('DELETE FROM login_failures WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT OR REPLACE INTO login_failures (challenge, error, expires_at) VALUES (?, ?, ?)').run(
    challenge,
    error,
    Date.now() + LOGIN_CODE_TTL,
  );
}

export function getUser(db: Db, id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!row) return null;
  const providers = (db.prepare('SELECT provider FROM identities WHERE user_id = ?').all(id) as { provider: string }[]).map(
    (r) => r.provider,
  );
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    providers,
  };
}

/** 회원 탈퇴: 연결된 증권사 키, 자산 기록, 세션이 모두 함께 삭제된다 (ON DELETE CASCADE) */
export function deleteUser(db: Db, id: string) {
  transaction(db, () => {
    // kv(증권사 접근 토큰 캐시)는 외래키로 묶여 있지 않아 따로 지운다
    const conns = db.prepare('SELECT id FROM connections WHERE user_id = ?').all(id) as { id: string }[];
    const delToken = db.prepare('DELETE FROM kv WHERE key = ?');
    for (const c of conns) delToken.run(tokenCacheKey(c.id));
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
}

// --- 1회용 로그인 코드 ---

export function createLoginCode(db: Db, userId: string, challenge: string) {
  db.prepare('DELETE FROM login_codes WHERE expires_at < ?').run(Date.now());
  const code = token();
  db.prepare('INSERT INTO login_codes (code_hash, user_id, challenge, expires_at) VALUES (?, ?, ?, ?)').run(
    sha256(code),
    userId,
    challenge,
    Date.now() + LOGIN_CODE_TTL,
  );
  return code;
}

/**
 * 앱이 로그인 시작 때 보낸 challenge = SHA256(verifier) 를 확인한다.
 * 딥링크를 다른 앱이 가로채도 verifier 없이는 세션을 받을 수 없다.
 */
export function redeemLoginCode(db: Db, code: string, verifier: string): string | null {
  const hash = sha256(code);
  const row = db.prepare('SELECT * FROM login_codes WHERE code_hash = ?').get(hash) as
    | { user_id: string; challenge: string; expires_at: number }
    | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM login_codes WHERE code_hash = ?').run(hash);
  if (row.expires_at < Date.now() || !safeEqual(sha256(verifier), row.challenge)) return null;
  return row.user_id;
}

/**
 * 폴링용: 코드 없이 verifier 만으로, 이 verifier 의 challenge 로 발급된 로그인 코드를 찾아 사용한다.
 * 딥링크로 앱에 돌아오지 못하는 환경(안드로이드 Expo Go 등)에서도 로그인을 마칠 수 있게 한다.
 * challenge 는 로그인 시작 때 앱이 보낸 SHA256(verifier) 이므로 verifier 를 가진 기기만 받을 수 있다.
 */
export function redeemByVerifier(db: Db, verifier: string): { userId: string } | { error: string } | null {
  if (!verifier) return null;
  const challenge = sha256(verifier);

  const failure = db.prepare('SELECT error, expires_at FROM login_failures WHERE challenge = ?').get(challenge) as
    | { error: string; expires_at: number }
    | undefined;
  if (failure) {
    db.prepare('DELETE FROM login_failures WHERE challenge = ?').run(challenge);
    if (failure.expires_at >= Date.now()) return { error: failure.error };
  }

  const row = db
    .prepare('SELECT code_hash, user_id, expires_at FROM login_codes WHERE challenge = ? ORDER BY expires_at DESC LIMIT 1')
    .get(challenge) as { code_hash: string; user_id: string; expires_at: number } | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM login_codes WHERE challenge = ?').run(challenge);
  return row.expires_at < Date.now() ? null : { userId: row.user_id };
}

// --- 세션 ---

export function createSession(db: Db, userId: string) {
  const value = token();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    sha256(value),
    userId,
    now,
    now,
    Date.now() + config.sessionDays * 86_400_000,
  );
  return value;
}

export function userIdForSession(db: Db, value: string): string | null {
  const hash = sha256(value);
  const row = db.prepare('SELECT user_id, expires_at, last_used_at FROM sessions WHERE token_hash = ?').get(hash) as
    | { user_id: string; expires_at: number; last_used_at: string }
    | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  // 매 요청마다 쓰지 않도록 1시간에 한 번만 갱신
  if (Date.now() - Date.parse(row.last_used_at) > 3_600_000) {
    db.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?').run(new Date().toISOString(), hash);
  }
  return row.user_id;
}

export function deleteSession(db: Db, value: string) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(value));
}
