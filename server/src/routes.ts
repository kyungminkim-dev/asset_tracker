import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { deleteSession, deleteUser, getUser } from './auth/service.js';
import { getBroker, listBrokers } from './brokers/registry.js';
import type { Db } from './db.js';
import {
  adapterFor,
  createConnection,
  deleteConnection,
  getConnection,
  listConnections,
  publicConnection,
} from './services/connections.js';
import { history, RANGES, summary, type Range } from './services/portfolio.js';
import { syncUser } from './services/sync.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** 로그인한 사용자 (index.ts 의 인증 훅에서 채운다) */
    userId: string;
    sessionToken: string;
  }
}

const parseRange = (value: unknown): Range => (typeof value === 'string' && value in RANGES ? (value as Range) : '1M');

/** 로그인이 필요한 경로들. 모든 조회/수정은 req.userId 범위 안에서만 일어난다 */
export function registerRoutes(app: FastifyInstance, db: Db) {
  // --- 내 계정 ---
  app.get('/api/me', async (req) => getUser(db, req.userId));

  app.post('/api/logout', async (req) => {
    deleteSession(db, req.sessionToken);
    return { ok: true };
  });

  /** 회원 탈퇴: 증권사 키와 자산 기록까지 모두 삭제 */
  app.delete('/api/me', async (req) => {
    deleteUser(db, req.userId);
    return { ok: true };
  });

  // --- 증권사 연결 ---
  app.get('/api/brokers', async () => listBrokers());

  app.get('/api/connections', async (req) => listConnections(db, req.userId).map(publicConnection));

  /** 연결 추가: 저장 전에 실제로 한 번 조회해 키가 맞는지 확인한다 */
  app.post<{ Body: { brokerId: string; label?: string; credentials?: Record<string, string> } }>(
    '/api/connections',
    async (req, reply) => {
      const { brokerId, label = '', credentials = {} } = req.body ?? ({} as any);
      const row = createConnection(db, req.userId, brokerId, label, credentials);
      if (getBroker(brokerId).kind === 'api') {
        try {
          await adapterFor(db, row).fetchAccounts();
        } catch (err) {
          deleteConnection(db, req.userId, row.id);
          return reply.code(400).send({ error: `연결 확인 실패: ${(err as Error).message}` });
        }
      }
      return publicConnection(row);
    },
  );

  app.delete<{ Params: { id: string } }>('/api/connections/:id', async (req) => {
    deleteConnection(db, req.userId, req.params.id);
    return { ok: true };
  });

  // --- 직접 입력 종목 ---
  app.addHook('preHandler', async (req, reply) => {
    const id = (req.params as { id?: string })?.id;
    if (!id || !req.routeOptions.url?.includes('/manual-positions')) return;
    const row = getConnection(db, req.userId, id);
    if (!row) return reply.code(404).send({ error: '연결을 찾을 수 없습니다.' });
    if (getBroker(row.broker_id).kind !== 'manual') return reply.code(400).send({ error: '직접 입력 연결이 아닙니다.' });
  });

  app.get<{ Params: { id: string } }>('/api/connections/:id/manual-positions', async (req) =>
    db.prepare('SELECT * FROM manual_positions WHERE connection_id = ? ORDER BY symbol').all(req.params.id),
  );

  app.put<{
    Params: { id: string; positionId?: string };
    Body: { symbol: string; name: string; market: string; currency: string; quantity: number; avgPrice: number; currentPrice: number };
  }>('/api/connections/:id/manual-positions/:positionId?', async (req) => {
    const b = req.body;
    const id = req.params.positionId ?? randomUUID();
    // 다른 연결의 종목 ID 를 덮어쓰지 못하게 connection_id 까지 확인
    const existing = db.prepare('SELECT connection_id FROM manual_positions WHERE id = ?').get(id) as
      | { connection_id: string }
      | undefined;
    if (existing && existing.connection_id !== req.params.id) throw new Error('종목을 찾을 수 없습니다.');
    db.prepare(
      `INSERT OR REPLACE INTO manual_positions
       (id, connection_id, symbol, name, market, currency, quantity, avg_price, current_price, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, req.params.id, b.symbol, b.name || b.symbol, b.market, b.currency, Number(b.quantity), Number(b.avgPrice),
      Number(b.currentPrice), new Date().toISOString());
    return { id };
  });

  app.delete<{ Params: { id: string; positionId: string } }>(
    '/api/connections/:id/manual-positions/:positionId',
    async (req) => {
      db.prepare('DELETE FROM manual_positions WHERE id = ? AND connection_id = ?').run(req.params.positionId, req.params.id);
      return { ok: true };
    },
  );

  // --- 동기화 / 포트폴리오 ---
  app.post('/api/sync', async (req) => syncUser(db, req.userId));

  app.get<{ Querystring: { range?: string } }>('/api/portfolio/summary', async (req) =>
    summary(db, req.userId, parseRange(req.query.range)),
  );

  app.get<{ Querystring: { range?: string } }>('/api/portfolio/history', async (req) =>
    history(db, req.userId, parseRange(req.query.range)),
  );
}
