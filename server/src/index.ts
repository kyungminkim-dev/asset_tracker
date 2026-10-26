import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import cron from 'node-cron';
import { config } from './config.js';
import { openDb } from './db.js';
import { registerRoutes } from './routes.js';
import { syncAll } from './services/sync.js';

const db = openDb();
const app = Fastify({ logger: { level: 'info' } });

// POST /api/sync 처럼 본문 없는 요청도 허용
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  try {
    done(null, body ? JSON.parse(body as string) : {});
  } catch (err) {
    done(err as Error, undefined);
  }
});

const expected =Buffer.from(`Bearer ${config.appToken}`);
app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health') return;
  const got = Buffer.from(req.headers.authorization ?? '');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

app.setErrorHandler((err: Error, _req, reply) => {
  app.log.error(err);
  reply.code(400).send({ error: err.message });
});

app.get('/health', async () => ({ ok: true }));
registerRoutes(app, db);

// 매일 정해진 시각에 자동으로 스냅샷을 남긴다 (기간별 변화 그래프용)
cron.schedule(
  config.snapshotCron,
  async () => {
    try {
      const result = await syncAll(db);
      app.log.info({ result }, 'scheduled snapshot done');
    } catch (err) {
      app.log.error(err, 'scheduled snapshot failed');
    }
  },
  { timezone: config.timezone },
);

await app.listen({ port: config.port, host: '0.0.0.0' });
