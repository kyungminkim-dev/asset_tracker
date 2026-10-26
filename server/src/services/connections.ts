import { randomUUID } from 'node:crypto';
import { getBroker } from '../brokers/registry.js';
import { decryptJson, encryptJson } from '../crypto.js';
import type { Db } from '../db.js';

export interface ConnectionRow {
  id: string;
  user_id: string;
  broker_id: string;
  label: string;
  credentials: string;
  created_at: string;
  last_synced_at: string | null;
  last_error: string | null;
}

export function listConnections(db: Db, userId: string) {
  return db
    .prepare('SELECT * FROM connections WHERE user_id = ? ORDER BY created_at')
    .all(userId) as unknown as ConnectionRow[];
}

/** 다른 사용자의 연결은 찾지 못한다 */
export function getConnection(db: Db, userId: string, id: string) {
  return db.prepare('SELECT * FROM connections WHERE id = ? AND user_id = ?').get(id, userId) as unknown as
    | ConnectionRow
    | undefined;
}

/** 앱에 내려보낼 때는 credentials 를 절대 포함하지 않는다 */
export function publicConnection(row: ConnectionRow) {
  const broker = getBroker(row.broker_id);
  return {
    id: row.id,
    brokerId: row.broker_id,
    brokerName: broker.name,
    kind: broker.kind,
    label: row.label,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

export function createConnection(
  db: Db,
  userId: string,
  brokerId: string,
  label: string,
  credentials: Record<string, string>,
) {
  const broker = getBroker(brokerId);
  const clean: Record<string, string> = {};
  for (const field of broker.credentialFields) {
    const value = String(credentials[field.key] ?? '').trim();
    if (!value && !field.optional) throw new Error(`${field.label} 을(를) 입력하세요.`);
    if (field.options && value && !field.options.some((o) => o.value === value)) {
      throw new Error(`${field.label} 값이 올바르지 않습니다.`);
    }
    clean[field.key] = value;
  }
  const row: ConnectionRow = {
    id: randomUUID(),
    user_id: userId,
    broker_id: brokerId,
    label: label.trim() || broker.name,
    credentials: encryptJson(clean),
    created_at: new Date().toISOString(),
    last_synced_at: null,
    last_error: null,
  };
  db.prepare(
    'INSERT INTO connections (id, user_id, broker_id, label, credentials, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(row.id, row.user_id, row.broker_id, row.label, row.credentials, row.created_at);
  return row;
}

export function deleteConnection(db: Db, userId: string, id: string) {
  db.prepare('DELETE FROM connections WHERE id = ? AND user_id = ?').run(id, userId);
}

export function adapterFor(db: Db, row: ConnectionRow) {
  return getBroker(row.broker_id).create(decryptJson<Record<string, string>>(row.credentials), {
    connectionId: row.id,
    db,
  });
}
