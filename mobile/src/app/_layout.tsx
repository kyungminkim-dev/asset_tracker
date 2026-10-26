import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RangeProvider } from '@/lib/range';
import { useTheme } from '@/lib/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <RangeProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          headerBackTitle: '뒤로',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connect/index" options={{ title: '증권사 선택' }} />
        <Stack.Screen name="connect/[brokerId]" options={{ title: '증권사 연결' }} />
        <Stack.Screen name="manual/[id]" options={{ title: '보유 종목 입력' }} />
        <Stack.Screen name="settings" options={{ title: '서버 설정', presentation: 'modal' }} />
      </Stack>
    </RangeProvider>
  );
}
