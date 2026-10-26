import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export type Db = DatabaseSync;

export function openDb(path = config.dbPath): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    -- 연결된 증권사 계정. credentials 는 암호화된 JSON
    CREATE TABLE IF NOT EXISTS connections (
      id             TEXT PRIMARY KEY,
      broker_id      TEXT NOT NULL,
      label          TEXT NOT NULL,
      credentials    TEXT NOT NULL,
      created_at     TEXT NOT NULL,
      last_synced_at TEXT,
      last_error     TEXT
    );

    -- 하루 1건의 전체 자산 스냅샷 (기간별 변화 그래프의 원천 데이터)
    CREATE TABLE IF NOT EXISTS snapshots (
      date            TEXT PRIMARY KEY,   -- YYYY-MM-DD (KST)
      taken_at        TEXT NOT NULL,
      fx              TEXT NOT NULL,      -- {"USD": 1324.5, ...} 1단위당 원화
      total_value_krw REAL NOT NULL,      -- 주식 평가액 + 예수금
      total_cost_krw  REAL NOT NULL,      -- 주식 매입금액
      cash_krw        REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snapshot_positions (
      date             TEXT NOT NULL REFERENCES snapshots(date) ON DELETE CASCADE,
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
      stale            INTEGER NOT NULL DEFAULT 0  -- 동기화 실패로 이전 값을 이어붙인 경우 1
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_positions_date ON snapshot_positions(date);

    CREATE TABLE IF NOT EXISTS snapshot_cash (
      date          TEXT NOT NULL REFERENCES snapshots(date) ON DELETE CASCADE,
      connection_id TEXT NOT NULL,
      account_id    TEXT NOT NULL,
      currency      TEXT NOT NULL,
      amount        REAL NOT NULL,
      amount_krw    REAL NOT NULL,
      stale         INTEGER NOT NULL DEFAULT 0
    );

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

    -- 접근 토큰 캐시 등 (값은 암호화)
    CREATE TABLE IF NOT EXISTS kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      expires_at INTEGER
    );
  `);
  return db;
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
