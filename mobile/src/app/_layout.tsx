import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RangeProvider } from '@/lib/range';
import { ThemeProvider, useTheme, useThemePreference } from '@/lib/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RangeProvider>
          <RootStack />
        </RangeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const t = useTheme();
  const { ready } = useThemePreference();
  const { status } = useAuth();

  // 화면 전환 시 바탕이 하얗게 번쩍이지 않도록 내비게이션 색도 테마에 맞춘다
  const navTheme = useMemo(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: t.bg, card: t.bg, text: t.text, border: t.border, primary: t.primary },
    };
  }, [t]);

  if (!ready || status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.sub} />
      </View>
    );
  }

  const signedIn = status === 'signedIn';
  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontSize: 17, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        {/* 로그인해야 볼 수 있는 화면 (서버도 세션으로 한 번 더 막는다) */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="connect/index" options={{ title: '' }} />
          <Stack.Screen name="connect/[brokerId]" options={{ title: '' }} />
          <Stack.Screen name="manual/[id]" options={{ title: '' }} />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ title: '' }} />
        </Stack.Protected>

        <Stack.Screen name="server" options={{ title: '서버 설정', presentation: 'modal' }} />
        {/* 로그인 후 assettracker://auth 로 돌아올 때 라우터가 잡는 자리 */}
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'none' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
