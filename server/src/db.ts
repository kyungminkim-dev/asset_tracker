import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export type Db = DatabaseSync;

export function openDb(path = config.dbPath): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  // 회원 기능 이전(단일 사용자)에 만든 DB 는 구조가 달라 그대로 쓸 수 없다
  const cols = db.prepare("SELECT name FROM pragma_table_info('connections')").all() as { name: string }[];
  if (cols.length > 0 && !cols.some((c) => c.name === 'user_id')) {
    throw new Error(`${path} 는 회원 기능 이전의 DB 입니다. 파일을 지우거나 DB_PATH 를 바꾼 뒤 다시 실행하세요.`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      email        TEXT,
      avatar_url   TEXT,
      created_at   TEXT NOT NULL
    );

    -- 소셜 로그인 계정. (provider, subject) 로 사용자를 찾는다. 이메일로 계정을 합치지 않는다
    CREATE TABLE IF NOT EXISTS identities (
      provider   TEXT NOT NULL,          -- google | kakao
      subject    TEXT NOT NULL,          -- 제공자의 사용자 고유 ID
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email      TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, subject)
    );

    -- 로그인 세션. 토큰 원문은 저장하지 않고 SHA-256 해시만 둔다
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash   TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      expires_at   INTEGER NOT NULL
    );

    -- OAuth 진행 중 상태 (CSRF 방지용 state, 앱 복귀 주소, 앱 검증값)
    CREATE TABLE IF NOT EXISTS oauth_states (
      state        TEXT PRIMARY KEY,
      provider     TEXT NOT NULL,
      app_redirect TEXT NOT NULL,
      challenge    TEXT NOT NULL,
      expires_at   INTEGER NOT NULL
    );

    -- 로그인 직후 앱에 넘기는 1회용 코드. 앱이 검증값과 함께 세션 토큰으로 교환한다
    CREATE TABLE IF NOT EXISTS login_codes (
      code_hash  TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge  TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- 연결된 증권사 계정. credentials 는 암호화된 JSON
    CREATE TABLE IF NOT EXISTS connections (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      broker_id      TEXT NOT NULL,
      label          TEXT NOT NULL,
      credentials    TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      last_synced_at TEXT,
      last_error     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id);

    -- 사용자별 하루 1건의 전체 자산 스냅샷 (기간별 변화 그래프의 원천 데이터)
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date            TEXT NOT NULL,      -- YYYY-MM-DD (KST)
      taken_at        TEXT NOT NULL,
      fx              TEXT NOT NULL,      -- {"USD": 1324.5, ...} 1단위당 원화
      total_value_krw REAL NOT NULL,      -- 주식 평가액 + 예수금
      total_cost_krw  REAL NOT NULL,      -- 주식 매입금액
      cash_krw        REAL NOT NULL,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS snapshot_positions (
      user_id          TEXT NOT NULL,
      date             TEXT NOT NULL,
      connection_id    TEXT NOT NULL,
      account_id       TEXT NOT NULL,
      symbol           TEXT NOT NULL,
      name             TEXT NOT NULL,
      market           TEXT NOT NULL,
      currency         TEXT NOT NULL,
      quantity         REAL NOT NULL,
      avg_price        REAL NOT NULL,
      current_price    REAL NOT NULL,
      market_value     REAL NOT NULL,
      cost_basis       REAL NOT NULL,
      market_value_krw REAL NOT NULL,
      cost_basis_krw   REAL NOT NULL,
      stale            INTEGER NOT NULL DEFAULT 0,  -- 동기화 실패로 이전 값을 이어붙인 경우 1
      FOREIGN KEY (user_id, date) REFERENCES snapshots(user_id, date) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_positions ON snapshot_positions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_snapshot_positions_conn ON snapshot_positions(connection_id, date);

    CREATE TABLE IF NOT EXISTS snapshot_cash (
      user_id       TEXT NOT NULL,
      date          TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      account_id    TEXT NOT NULL,
      currency      TEXT NOT NULL,
      amount        REAL NOT NULL,
      amount_krw    REAL NOT NULL,
      stale         INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id, date) REFERENCES snapshots(user_id, date) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_cash ON snapshot_cash(user_id, date);

    -- API 가 없는 증권사(직접 입력)용 보유 종목
    CREATE TABLE IF NOT EXISTS manual_positions (
      id            TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      symbol        TEXT NOT NULL,
      name          TEXT NOT NULL,
      market        TEXT NOT NULL,
      currency      TEXT NOT NULL,
      quantity      REAL NOT NULL,
      avg_price     REAL NOT NULL,
      current_price REAL NOT NULL,
      updated_at    TEXT NOT NULL
    );

    -- 증권사 접근 토큰 캐시 등 (값은 암호화)
    CREATE TABLE IF NOT EXISTS kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      expires_at INTEGER
    );

    -- 로그인/가입이 실패로 끝난 경우 (폴링하는 앱에 이유를 알려주기 위함)
    CREATE TABLE IF NOT EXISTS login_failures (
      challenge  TEXT PRIMARY KEY,
      error      TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  // 나중에 추가된 컬럼
  addColumn(db, 'users', 'terms_agreed_at', 'TEXT');
  addColumn(db, 'oauth_states', 'mode', "TEXT NOT NULL DEFAULT 'login'"); // login | signup
  return db;
}

function addColumn(db: Db, table: string, column: string, definition: string) {
  const cols = db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
