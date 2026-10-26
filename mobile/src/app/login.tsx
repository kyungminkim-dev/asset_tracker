import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialButtons } from '@/components/SocialButtons';
import { api, type AuthProvider } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Login() {
  const t = useTheme();
  const { signIn } = useAuth();
  const { data: providers, error, loading, reload } = useAsync(() => api.authProviders());
  const [busy, setBusy] = useState<AuthProvider['id'] | null>(null);

  const start = async (id: AuthProvider['id']) => {
    setBusy(id);
    try {
      await signIn(id, 'login');
    } catch (err) {
      Alert.alert('로그인하지 못했어요', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: t.text }]}>흩어진 내 주식,{'\n'}한눈에 모아보세요</Text>
        <Text style={[styles.subtitle, { color: t.sub }]}>
          여러 증권사 계좌를 연결하고{'\n'}기간별 자산 변화를 확인할 수 있어요.
        </Text>
      </View>

      <View style={styles.bottom}>
        {loading && !providers ? <ActivityIndicator color={t.sub} /> : null}

        {error ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Text style={{ color: t.sub, textAlign: 'center' }}>{error}</Text>
            <Pressable onPress={reload} hitSlop={8}>
              <Text style={{ color: t.primary, fontWeight: '700' }}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {providers?.length === 0 ? (
          <Text style={{ color: t.sub, textAlign: 'center' }}>
            서버에 설정된 로그인 방식이 없습니다.{'\n'}서버 .env 의 구글/카카오 키를 확인하세요.
          </Text>
        ) : null}

        {providers?.length ? <SocialButtons providers={providers} mode="login" busy={busy} onPress={start} /> : null}

        <Pressable onPress={() => router.push('/server')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={{ color: t.sub, fontSize: 13 }}>서버 설정</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  hero: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, lineHeight: 38, marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  bottom: { gap: 16, paddingBottom: 24 },
});
