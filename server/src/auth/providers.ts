import { config } from '../config.js';

/** 제공자가 알려준 사용자 정보 */
export interface OAuthProfile {
  subject: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface OAuthProvider {
  id: 'google' | 'kakao' | 'dev';
  name: string;
  enabled: boolean;
  authorizeUrl(params: { state: string; redirectUri: string }): string;
  /** 인가 코드를 토큰으로 바꾸고 사용자 정보를 가져온다 */
  fetchProfile(params: { code: string; redirectUri: string }): Promise<OAuthProfile>;
}

async function postForm(url: string, form: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`토큰 교환 실패: ${body.error_description ?? body.error ?? res.status}`);
  return body;
}

async function getJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`사용자 정보 조회 실패: ${res.status}`);
  return (await res.json()) as any;
}

const google: OAuthProvider = {
  id: 'google',
  name: '구글',
  enabled: !!(config.google.clientId && config.google.clientSecret),
  authorizeUrl: ({ state, redirectUri }) =>
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    })}`,
  async fetchProfile({ code, redirectUri }) {
    const token = await postForm('https://oauth2.googleapis.com/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
    });
    const me = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token.access_token);
    if (!me.sub) throw new Error('구글 사용자 ID 가 없습니다.');
    return {
      subject: String(me.sub),
      displayName: me.name ?? me.email ?? '구글 사용자',
      email: me.email_verified ? (me.email ?? null) : null,
      avatarUrl: me.picture ?? null,
    };
  },
};

const kakao: OAuthProvider = {
  id: 'kakao',
  name: '카카오',
  enabled: !!config.kakao.restApiKey,
  authorizeUrl: ({ state, redirectUri }) =>
    `https://kauth.kakao.com/oauth/authorize?${new URLSearchParams({
      client_id: config.kakao.restApiKey,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })}`,
  async fetchProfile({ code, redirectUri }) {
    const token = await postForm('https://kauth.kakao.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: config.kakao.restApiKey,
      redirect_uri: redirectUri,
      code,
      ...(config.kakao.clientSecret ? { client_secret: config.kakao.clientSecret } : {}),
    });
    const me = await getJson('https://kapi.kakao.com/v2/user/me', token.access_token);
    if (!me.id) throw new Error('카카오 회원번호가 없습니다.');
    const account = me.kakao_account ?? {};
    return {
      subject: String(me.id),
      displayName: account.profile?.nickname ?? '카카오 사용자',
      // 이메일은 동의항목을 켠 경우에만 온다
      email: account.is_email_verified ? (account.email ?? null) : null,
      avatarUrl: account.profile?.thumbnail_image_url ?? null,
    };
  },
};

/**
 * 개발용 테스트 로그인. DEV_LOGIN=true 일 때만 켜진다.
 * 외부 제공자 대신 서버의 /auth/dev/authorize 페이지를 쓰고, 이후 흐름(state·1회용 코드·verifier)은 실제 로그인과 같다.
 */
const dev: OAuthProvider = {
  id: 'dev',
  name: '테스트 계정',
  enabled: config.devLogin,
  authorizeUrl: ({ state }) => `${config.publicUrl}/auth/dev/authorize?${new URLSearchParams({ state })}`,
  fetchProfile: async () => ({ subject: 'dev-user', displayName: '테스트 사용자', email: null, avatarUrl: null }),
};

export const providers: Record<string, OAuthProvider> = { google, kakao, dev };

export const callbackUrl = (provider: string) => `${config.publicUrl}/auth/${provider}/callback`;
