import { useColorScheme } from 'react-native';

// 국내 증권 앱 관례: 상승은 빨강, 하락은 파랑
const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#16181D',
  sub: '#6B7280',
  border: '#E5E7EB',
  primary: '#3866F5',
  up: '#E5383B',
  down: '#2F6BE4',
  palette: ['#3866F5', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#9CA3AF'],
};

const dark: typeof light = {
  bg: '#0E0F12',
  card: '#1A1C21',
  text: '#F3F4F6',
  sub: '#9CA3AF',
  border: '#2A2D34',
  primary: '#6A8CFF',
  up: '#FF5A5F',
  down: '#5B8DEF',
  palette: ['#6A8CFF', '#FBBF24', '#34D399', '#A78BFA', '#F87171', '#22D3EE', '#9CA3AF'],
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const changeColor = (t: Theme, n: number) => (n > 0 ? t.up : n < 0 ? t.down : t.sub);
