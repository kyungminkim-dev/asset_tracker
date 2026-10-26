import * as SecureStore from 'expo-secure-store';

// 서버 주소와 로그인 세션 토큰은 기기의 보안 저장소(Keychain/Keystore)에 보관한다.
const KEYS = { url: 'server_url', session: 'session_token', verifier: 'pending_login_verifier' } as const;

export async function loadServerUrl(): Promise<string> {
  return (await SecureStore.getItemAsync(KEYS.url)) ?? process.env.EXPO_PUBLIC_API_URL ?? '';
}

export async function saveServerUrl(url: string) {
  await SecureStore.setItemAsync(KEYS.url, url.trim().replace(/\/+$/, ''));
}

export const loadSession = () => SecureStore.getItemAsync(KEYS.session);

export async function saveSession(token: string | null) {
  if (token) await SecureStore.setItemAsync(KEYS.session, token);
  else await SecureStore.deleteItemAsync(KEYS.session);
}

/** 로그인 진행 중인 verifier. 브라우저에서 돌아오는 동안 앱이 재시작돼도 로그인을 마칠 수 있게 보관한다 */
export const loadPendingVerifier = () => SecureStore.getItemAsync(KEYS.verifier);

export async function savePendingVerifier(verifier: string | null) {
  if (verifier) await SecureStore.setItemAsync(KEYS.verifier, verifier);
  else await SecureStore.deleteItemAsync(KEYS.verifier);
}
