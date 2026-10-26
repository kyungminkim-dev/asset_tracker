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
import { newsProvider, newsQuery, searchNews } from './news/index.js';
import { history, parsePeriod, summary } from './services/portfolio.js';
import { syncUser } from './services/sync.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** 로그인한 사용자 (index.ts 의 인증 훅에서 채운다) */
    userId: string;
    sessionToken: string;
  }
}

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

  // --- 뉴스 ---
  /** 최근 스냅샷 기준 보유 종목 (평가액 큰 순) */
  const heldStocks = (userId: string) =>
    db
      .prepare(
        `SELECT symbol, name, market, SUM(market_value_krw) AS value FROM snapshot_positions
         WHERE user_id = ? AND date = (SELECT MAX(date) FROM snapshots WHERE user_id = ?)
         GROUP BY market, symbol ORDER BY value DESC`,
      )
      .all(userId, userId) as { symbol: string; name: string; market: string }[];

  /**
   * 보유 종목 뉴스. symbol/market 을 주면 그 종목만, 없으면 평가액 상위 5종목 뉴스를 최신순으로 섞어서.
   * 보유하지 않은 종목은 조회할 수 없다 (서버가 아무 검색어나 대신 검색해 주는 통로가 되지 않도록).
   */
  app.get<{ Querystring: { symbol?: string; market?: string } }>('/api/news', async (req, reply) => {
    const held = heldStocks(req.userId);
    const { symbol, market } = req.query;
    const targets = symbol ? held.filter((s) => s.symbol === symbol && (!market || s.market === market)) : held.slice(0, 5);
    if (symbol && targets.length === 0) return reply.code(404).send({ error: '보유한 종목이 아닙니다.' });

    const results = await Promise.allSettled(
      targets.map(async (s) => (await searchNews(newsQuery(s.name, s.market), symbol ? 30 : 10)).map((n) => ({ ...n, symbol: s.symbol, name: s.name }))),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (targets.length > 0 && failed.length === targets.length) {
      return reply.code(502).send({ error: `뉴스를 가져오지 못했어요: ${(failed[0] as PromiseRejectedResult).reason?.message ?? ''}` });
    }

    // 여러 종목에 같은 기사가 걸리면 하나만 남기고 최신순으로
    const seen = new Set<string>();
    const items = results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .filter((n) => !seen.has(n.title) && seen.add(n.title))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, 40);

    return {
      provider: { id: newsProvider.id, name: newsProvider.name, notice: newsProvider.notice ?? null },
      items,
    };
  });

  // --- 동기화 / 포트폴리오 ---
  app.post('/api/sync', async (req) => syncUser(db, req.userId));

  // range=1W|1M|3M|6M|1Y|ALL 또는 from=YYYY-MM-DD&to=YYYY-MM-DD (직접 선택)
  type PeriodQuery = { Querystring: { range?: string; from?: string; to?: string } };

  app.get<PeriodQuery>('/api/portfolio/summary', async (req) => summary(db, req.userId, parsePeriod(req.query)));

  app.get<PeriodQuery>('/api/portfolio/history', async (req) => history(db, req.userId, parsePeriod(req.query)));
}
