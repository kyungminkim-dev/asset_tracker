import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type AuthProvider as Provider, setUnauthorizedHandler, type User } from './api';
import { loadPendingVerifier, loadServerUrl, loadSession, savePendingVerifier, saveSession } from './settings';

type Status = 'loading' | 'signedOut' | 'signedIn';
export type AuthMode = 'login' | 'signup';

interface AuthState {
  status: Status;
  user: User | null;
  /** mode: login(기존 회원) | signup(가입, 약관 동의를 마친 뒤 호출) */
  signIn: (provider: Provider['id'], mode?: AuthMode) => Promise<void>;
  /** 로그인 후 앱으로 돌아온 주소(…/auth?code=…)로 로그인을 마친다. 같은 코드는 한 번만 처리한다 */
  completeSignIn: (params: { code?: unknown; error?: unknown }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** 서버를 바꾸는 등 서버 호출 없이 로컬 세션만 지울 때 */
  clearLocalSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const LOGIN_ERRORS: Record<string, string> = {
  access_denied: '로그인을 취소했어요.',
  cancelled: '로그인을 취소했어요.',
  login_failed: '로그인 처리 중 문제가 생겼어요. 잠시 후 다시 시도하세요.',
  not_registered: '가입되지 않은 계정이에요. 회원가입을 먼저 해주세요.',
};

const loginError = (code: string) => new ApiError(LOGIN_ERRORS[code] ?? `로그인 실패: ${code}`, undefined, code);

// 같은 1회용 코드를 두 경로(openAuthSessionAsync 결과, /auth 라우트)에서 동시에 교환하지 않도록 기록
const handledCodes = new Map<string, Promise<void>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 5 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const clearLocalSession = useCallback(async () => {
    await saveSession(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  // 앱 시작 시 저장된 세션으로 로그인 상태 복원
  useEffect(() => {
    setUnauthorizedHandler(() => void clearLocalSession());
    (async () => {
      if (!(await loadSession())) return setStatus('signedOut');
      try {
        setUser(await api.me());
        setStatus('signedIn');
      } catch (err) {
        // 401 은 핸들러가 로그아웃 처리한다. 서버에 잠시 못 닿는 경우엔 세션을 유지한 채 앱으로 들어간다
        if (!(err instanceof ApiError && err.status === 401)) setStatus('signedIn');
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession]);

  /** 세션을 받으면 저장하고 로그인 상태로 바꾼다 */
  const applySession = useCallback(async ({ token, user }: { token: string; user: User }) => {
    await savePendingVerifier(null);
    await saveSession(token);
    setUser(user);
    setStatus('signedIn');
  }, []);

  const completeSignIn = useCallback(
    async ({ code, error }: { code?: unknown; error?: unknown }) => {
      if (typeof error === 'string') {
        await savePendingVerifier(null);
        throw loginError(error);
      }
      if (typeof code !== 'string') throw new ApiError('로그인 응답이 올바르지 않습니다.');

      let job = handledCodes.get(code);
      if (!job) {
        job = (async () => {
          const verifier = await loadPendingVerifier();
          // 폴링이 먼저 로그인을 마쳤으면 verifier 가 지워져 있다
          if (!verifier) return;
          await applySession(await api.exchangeLoginCode(code, verifier));
        })();
        handledCodes.set(code, job);
      }
      return job;
    },
    [applySession],
  );

  /**
   * 브라우저에서 구글/카카오 로그인 → 서버가 1회용 코드를 발급 → 앱이 verifier 로 세션을 받는다.
   * verifier 는 기기 보안 저장소에만 있으므로, 딥링크를 다른 앱이 가로채도 세션을 받을 수 없다.
   *
   * 세션을 받는 경로는 셋이고 먼저 끝나는 쪽이 처리한다.
   * 1. openAuthSessionAsync 가 돌아온 주소를 받음 (iOS)
   * 2. 라우터가 /auth 화면을 열어 completeSignIn (안드로이드 일부)
   * 3. 폴링: 딥링크로 앱에 못 돌아오는 환경(안드로이드 Expo Go 등)에서 사용자가 브라우저를 닫으면 마무리
   */
  const signIn = useCallback(
    async (provider: Provider['id'], mode: AuthMode = 'login') => {
      const server = await loadServerUrl();
      if (!server) throw new ApiError('먼저 서버 주소를 설정하세요.');

      const verifier = toHex(Crypto.getRandomBytes(32));
      const challenge = toBase64Url(
        await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
          encoding: Crypto.CryptoEncoding.BASE64,
        }),
      );
      await savePendingVerifier(verifier);
      const redirect = Linking.createURL('auth');
      const params: Record<string, string> = { redirect_uri: redirect, challenge, mode };
      if (mode === 'signup') params.agree = '1'; // 가입 화면에서 필수 약관 동의를 마쳐야 여기까지 온다
      const startUrl = `${server}/auth/${provider}/start?${new URLSearchParams(params)}`;

      let done = false;
      let failure: string | null = null;
      const tryPoll = async () => {
        // 다른 경로가 먼저 마쳤으면 verifier 가 지워져 있다
        if (done || (await loadPendingVerifier()) !== verifier) return (done = true);
        try {
          const res = await api.pollLogin(verifier);
          if ('token' in res) {
            done = true;
            await applySession(res);
          } else if ('error' in res) {
            done = true;
            failure = res.error;
          }
        } catch {
          // 네트워크 오류는 다음 시도에서 다시
        }
        return done;
      };

      // 브라우저가 열려 있는 동안 주기적으로 확인하고, 로그인이 끝나면 창을 닫는다
      const polling = (async () => {
        const deadline = Date.now() + POLL_TIMEOUT;
        while (!done && Date.now() < deadline) {
          await sleep(POLL_INTERVAL);
          if (await tryPoll()) {
            // iOS 는 창을 닫는다. 안드로이드는 지원하지 않으므로 사용자가 닫으면 이미 로그인된 상태다
            try {
              WebBrowser.dismissAuthSession();
            } catch {}
            return;
          }
        }
      })();

      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirect);
      if (result.type === 'success' && !done) {
        done = true;
        await completeSignIn(Linking.parse(result.url).queryParams ?? {});
        return;
      }

      // 창이 닫힘: 방금 로그인을 마치고 닫았을 수 있으니 몇 번 더 확인한 뒤 멈춘다
      for (let i = 0; i < 3 && !done; i++) {
        if (await tryPoll()) break;
        await sleep(1000);
      }
      done = true;
      await polling;
      if (failure) {
        await savePendingVerifier(null);
        throw loginError(failure);
      }
    },
    [applySession, completeSignIn],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      await clearLocalSession();
    }
  }, [clearLocalSession]);

  const deleteAccount = useCallback(async () => {
    await api.deleteAccount();
    await clearLocalSession();
  }, [clearLocalSession]);

  const value = useMemo(
    () => ({ status, user, signIn, completeSignIn, signOut, deleteAccount, clearLocalSession }),
    [status, user, signIn, completeSignIn, signOut, deleteAccount, clearLocalSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
