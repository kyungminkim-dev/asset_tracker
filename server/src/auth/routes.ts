import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Db } from '../db.js';
import { escapeHtml } from '../html.js';
import { callbackUrl, providers } from './providers.js';
import {
  type AuthMode,
  consumeOAuthState,
  createLoginCode,
  createOAuthState,
  createSession,
  findOrCreateUser,
  getUser,
  isAllowedAppRedirect,
  recordLoginFailure,
  redeemByVerifier,
  redeemLoginCode,
} from './service.js';

const withQuery = (url: string, params: Record<string, string>) =>
  `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;

/** 로그인 과정에서 브라우저에 보여주는 간단한 페이지 */
function page(reply: FastifyReply, { title, body, status = 200 }: { title: string; body: string; status?: number }) {
  return reply
    .code(status)
    .type('text/html; charset=utf-8')
    .header('cache-control', 'no-store')
    .send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; justify-content:center; padding:24px; box-sizing:border-box;
         font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; background:#fff; color:#191F28; }
  h1 { font-size:24px; margin:0 0 8px; letter-spacing:-0.5px; } p { color:#8B95A1; margin:0 0 32px; line-height:1.5; }
  a.btn, button.btn { display:block; width:100%; height:56px; line-height:56px; border:0; border-radius:16px; background:#3182F6;
         color:#fff; font-size:17px; font-weight:700; text-align:center; text-decoration:none; font-family:inherit; }
  @media (prefers-color-scheme: dark) { body { background:#101013; color:#F3F4F6; } }
</style></head><body>${body}</body></html>`);
}

const errorPage = (reply: FastifyReply, message: string) =>
  page(reply, { title: '로그인 오류', status: 400, body: `<h1>로그인할 수 없어요</h1><p>${escapeHtml(message)}</p>` });

/**
 * 로그인을 마치고 앱으로 돌아가는 페이지.
 * 302 로 바로 앱 주소(assettracker://, exp://)로 보내면, 안드로이드 Chrome 은 사용자가 화면을 누르지 않은
 * 리디렉션 체인에서 외부 앱 열기를 막는다. 그래서 자동 이동을 시도하고, 막히면 버튼을 눌러 돌아가게 한다.
 */
function returnToApp(reply: FastifyReply, appUrl: string, { title, ok = false }: { title: string; ok?: boolean }) {
  const href = escapeHtml(appUrl);
  const js = JSON.stringify(appUrl).replace(/</g, '\\u003c');
  return page(reply, {
    title,
    body: `<h1>${escapeHtml(title)}</h1>
<p>${ok ? '이 창을 닫고 앱으로 돌아가면 자동으로 로그인돼요.' : '이 창을 닫고 앱으로 돌아가 주세요.'}</p>
<a class="btn" href="${href}">앱으로 돌아가기</a>
<script>location.replace(${js});</script>`,
  });
}

/** 로그인 없이 접근하는 경로들 */
export function registerAuthRoutes(app: FastifyInstance, db: Db) {
  app.get('/auth/providers', async () =>
    Object.values(providers)
      .filter((p) => p.enabled)
      .map((p) => ({ id: p.id, name: p.name })),
  );

  /**
   * ① 앱이 브라우저로 여는 주소.
   * redirect_uri: 로그인 후 돌아갈 앱 주소, challenge: base64url(SHA256(verifier))
   * mode: login(기존 회원만) | signup(가입, 필수 약관 동의 agree=1 필요)
   */
  app.get<{
    Params: { provider: string };
    Querystring: { redirect_uri?: string; challenge?: string; mode?: string; agree?: string };
  }>(
    '/auth/:provider/start',
    async (req, reply) => {
      const provider = providers[req.params.provider];
      if (!provider?.enabled) return errorPage(reply, '지원하지 않는 로그인 방식입니다.');
      const { redirect_uri: appRedirect = '', challenge = '' } = req.query;
      if (!isAllowedAppRedirect(appRedirect)) return errorPage(reply, '허용되지 않은 앱 주소입니다.');
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return errorPage(reply, '잘못된 로그인 요청입니다.');
      const mode: AuthMode = req.query.mode === 'signup' ? 'signup' : 'login';
      if (mode === 'signup' && req.query.agree !== '1') return errorPage(reply, '필수 약관에 동의해야 가입할 수 있습니다.');

      const state = createOAuthState(db, provider.id, appRedirect, challenge, mode);
      return reply.redirect(provider.authorizeUrl({ state, redirectUri: callbackUrl(provider.id) }));
    },
  );

  /** ② 구글/카카오가 돌려보내는 주소. 가입/로그인 처리 후 1회용 코드를 들고 앱으로 돌아간다 */
  app.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string; error?: string } }>(
    '/auth/:provider/callback',
    async (req, reply) => {
      const provider = providers[req.params.provider];
      if (!provider?.enabled) return errorPage(reply, '지원하지 않는 로그인 방식입니다.');
      const pending = consumeOAuthState(db, provider.id, req.query.state ?? '');
      if (!pending) return errorPage(reply, '로그인 요청이 만료되었습니다. 앱에서 다시 시도하세요.');

      const fail = (error: string, message: string) => {
        recordLoginFailure(db, pending.challenge, error);
        return returnToApp(reply, withQuery(pending.appRedirect, { error }), { title: message });
      };

      if (req.query.error || !req.query.code) return fail(req.query.error ?? 'cancelled', '로그인을 취소했어요');
      try {
        const profile = await provider.fetchProfile({ code: req.query.code, redirectUri: callbackUrl(provider.id) });
        const result = findOrCreateUser(db, provider.id, profile, pending.mode);
        if (!result) return fail('not_registered', '가입되지 않은 계정이에요');
        const code = createLoginCode(db, result.userId, pending.challenge);
        return returnToApp(reply, withQuery(pending.appRedirect, { code }), {
          title: result.created ? '가입을 마쳤어요' : '로그인을 마쳤어요',
          ok: true,
        });
      } catch (err) {
        req.log.error(err, 'oauth callback failed');
        return fail('login_failed', '로그인을 마치지 못했어요');
      }
    },
  );

  /** 개발용 테스트 로그인의 "로그인 페이지". 실제 제공자처럼 사용자가 버튼을 눌러 콜백으로 간다 */
  app.get<{ Querystring: { state?: string } }>('/auth/dev/authorize', async (req, reply) => {
    if (!providers.dev?.enabled) return errorPage(reply, '테스트 로그인이 꺼져 있습니다.');
    const href = escapeHtml(`${callbackUrl('dev')}?${new URLSearchParams({ code: 'dev', state: req.query.state ?? '' })}`);
    return page(reply, {
      title: '테스트 로그인',
      body: `<h1>테스트 계정으로 로그인</h1><p>개발용 로그인이에요. 배포 서버에서는 꺼 주세요.</p><a class="btn" href="${href}">로그인</a>`,
    });
  });

  /**
   * ③' 딥링크 대신 폴링으로 로그인을 마치는 경로. 아직 로그인 전이면 202 { pending: true }.
   * verifier 는 64자리 hex 이므로 추측할 수 없다.
   */
  app.post<{ Body: { verifier?: string } }>('/auth/poll', async (req, reply) => {
    const verifier = req.body?.verifier ?? '';
    if (!/^[0-9a-f]{64}$/.test(verifier)) return reply.code(400).send({ error: '잘못된 요청입니다.' });
    const result = redeemByVerifier(db, verifier);
    if (!result) return reply.code(202).send({ pending: true });
    if ('error' in result) return { error: result.error };
    return { token: createSession(db, result.userId), user: getUser(db, result.userId) };
  });

  /** ③ 앱이 1회용 코드 + verifier 를 세션 토큰으로 교환 */
  app.post<{ Body: { code?: string; verifier?: string } }>('/auth/exchange', async (req, reply) => {
    const { code = '', verifier = '' } = req.body ?? {};
    const userId = redeemLoginCode(db, code, verifier);
    if (!userId) return reply.code(401).send({ error: '로그인 코드가 유효하지 않습니다. 다시 시도하세요.' });
    return { token: createSession(db, userId), user: getUser(db, userId) };
  });
}
