import * as SecureStore from 'expo-secure-store';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

// 토스증권 느낌의 색 체계: 회색 바탕 위 흰 카드, 파란 강조색, 상승 빨강 / 하락 파랑
const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F2F4F6', // 화면 바탕
  card: '#FFFFFF', // 카드/섹션
  fill: '#F2F4F6', // 칩, 입력창, 눌림 배경
  text: '#191F28',
  text2: '#4E5968',
  sub: '#8B95A1',
  border: '#E5E8EB',
  primary: '#3182F6',
  primaryWeak: '#E8F3FF',
  primaryWeakText: '#1B64DA',
  up: '#F04452',
  down: '#3182F6',
  danger: '#F04452',
  dangerWeak: '#FFEEEE',
  success: '#03B26C',
  onPrimary: '#FFFFFF',
  palette: ['#3182F6', '#FFC342', '#03B26C', '#8B5CF6', '#F04452', '#18A5A5', '#B0B8C1'],
};

const dark: typeof light = {
  scheme: 'dark',
  bg: '#101013',
  card: '#1C1C21',
  fill: '#2C2C34',
  text: '#F3F4F6',
  text2: '#C3C3C8',
  sub: '#8A8A93',
  border: '#2C2C34',
  primary: '#4593FC',
  primaryWeak: 'rgba(69,147,252,0.16)',
  primaryWeakText: '#78B0FF',
  up: '#F45D6A',
  down: '#4593FC',
  danger: '#F45D6A',
  dangerWeak: 'rgba(244,93,106,0.14)',
  success: '#2FCB89',
  onPrimary: '#FFFFFF',
  palette: ['#4593FC', '#FFC342', '#2FCB89', '#A78BFA', '#F45D6A', '#3CC4C4', '#6B6B75'],
};

export type Theme = typeof light;
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_LABEL: Record<ThemePreference, string> = {
  system: '시스템 설정과 같게',
  light: '라이트 모드',
  dark: '다크 모드',
};

const STORAGE_KEY = 'theme_preference';

interface ThemeState {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeState>({ theme: light, preference: 'system', setPreference: () => {}, ready: true });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setPref(saved);
          Appearance.setColorScheme(saved);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    // 알림창, 키보드 같은 네이티브 UI 도 같은 모드로 맞춘다
    Appearance.setColorScheme(p === 'system' ? 'auto' : p);
    SecureStore.setItemAsync(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(
    () => ({ theme: scheme === 'dark' ? dark : light, preference, setPreference, ready }),
    [scheme, preference, setPreference, ready],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext).theme;
export const useThemePreference = () => useContext(ThemeContext);

export const changeColor = (t: Theme, n: number) => (n > 0 ? t.up : n < 0 ? t.down : t.sub);
