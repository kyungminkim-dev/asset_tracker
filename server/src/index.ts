import Fastify from 'fastify';
import cron from 'node-cron';
import { registerAuthRoutes } from './auth/routes.js';
import { userIdForSession } from './auth/service.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { registerRoutes } from './routes.js';
import { syncEveryone } from './services/sync.js';

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

app.setErrorHandler((err: Error, _req, reply) => {
  app.log.error(err);
  reply.code(400).send({ error: err.message });
});

app.get('/health', async () => ({ ok: true }));
registerAuthRoutes(app, db);

// /api/* 는 로그인 세션이 있어야 한다
app.register(async (api) => {
  api.decorateRequest('userId', '');
  api.decorateRequest('sessionToken', '');
  api.addHook('onRequest', async (req, reply) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const userId = token ? userIdForSession(db, token) : null;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    req.userId = userId;
    req.sessionToken = token;
  });
  registerRoutes(api, db);
});

// 매일 정해진 시각에 모든 사용자의 스냅샷을 남긴다 (기간별 변화 그래프용)
cron.schedule(
  config.snapshotCron,
  async () => {
    const results = await syncEveryone(db);
    app.log.info({ results }, 'scheduled snapshot done');
  },
  { timezone: config.timezone },
);

await app.listen({ port: config.port, host: '0.0.0.0' });
if (config.devLogin) app.log.warn('DEV_LOGIN=true: 개발용 테스트 로그인이 켜져 있습니다. 배포 서버에서는 끄세요.');
