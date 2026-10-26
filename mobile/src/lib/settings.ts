import * as SecureStore from 'expo-secure-store';

// 서버 주소와 접근 토큰은 기기의 보안 저장소(Keychain/Keystore)에 보관한다.
const KEYS = { url: 'server_url', token: 'app_token' } as const;

export interface ServerSettings {
  url: string;
  token: string;
}

export async function loadSettings(): Promise<ServerSettings> {
  const [url, token] = await Promise.all([
    SecureStore.getItemAsync(KEYS.url),
    SecureStore.getItemAsync(KEYS.token),
  ]);
  return {
    url: url ?? process.env.EXPO_PUBLIC_API_URL ?? '',
    token: token ?? '',
  };
}

export async function saveSettings({ url, token }: ServerSettings) {
  await SecureStore.setItemAsync(KEYS.url, url.trim().replace(/\/+$/, ''));
  await SecureStore.setItemAsync(KEYS.token, token.trim());
}
