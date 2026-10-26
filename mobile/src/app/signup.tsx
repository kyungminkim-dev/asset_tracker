import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { SocialButtons } from '@/components/SocialButtons';
import { Caption } from '@/components/ui';
import { api, type AuthProvider } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { openLegal } from '@/lib/legal';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

// 각 항목의 "보기"는 서버가 공개하는 문서(server/legal/*.md)를 연다. API 키 보관은 수집·이용 동의 3항에 설명돼 있다
const TERMS = [
  { key: 'service', label: '서비스 이용약관 동의', doc: 'terms' },
  { key: 'privacy', label: '개인정보 수집·이용 동의', doc: 'consent' },
  { key: 'credential', label: '증권사 API 키 암호화 보관 동의', doc: 'consent' },
] as const;

type TermKey = (typeof TERMS)[number]['key'];

/** 회원가입: 약관 동의 후 구글/카카오 OAuth 로 가입한다. 이미 가입된 계정이면 그대로 로그인된다 */
export default function Signup() {
  const t = useTheme();
  const { signIn } = useAuth();
  const { data: providers, error } = useAsync(() => api.authProviders());
  const [agreed, setAgreed] = useState<Set<TermKey>>(new Set());
  const [busy, setBusy] = useState<AuthProvider['id'] | null>(null);

  const all = agreed.size === TERMS.length;
  const requiredOk = TERMS.every((term) => agreed.has(term.key));

  const toggle = (key: TermKey) =>
    setAgreed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAll = () => setAgreed(all ? new Set() : new Set(TERMS.map((term) => term.key)));

  const start = async (id: AuthProvider['id']) => {
    setBusy(id);
    try {
      // 가입이 끝나면 Stack.Protected 가 홈으로 옮기고, 계좌가 없으니 자산 연결 화면이 뜬다
      await signIn(id, 'signup');
    } catch (err) {
      Alert.alert('가입하지 못했어요', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={[styles.title, { color: t.text }]}>회원가입</Text>
        <Caption style={{ marginBottom: 28 }}>약관에 동의하고, 가입할 계정을 선택해 주세요.</Caption>

        <Pressable onPress={toggleAll} style={[styles.allRow, { backgroundColor: t.fill }]}>
          <Check on={all} />
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>약관 전체 동의</Text>
        </Pressable>

        <View style={{ marginTop: 8 }}>
          {TERMS.map((term) => (
            <View key={term.key} style={styles.termRow}>
              <Pressable onPress={() => toggle(term.key)} style={styles.termToggle} hitSlop={4}>
                <Check on={agreed.has(term.key)} small />
                <Text style={{ color: t.text2, fontSize: 15, flex: 1 }}>
                  <Text style={{ color: t.primary }}>[필수] </Text>
                  {term.label}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => openLegal(term.doc).catch((err) => Alert.alert('문서를 열 수 없어요', (err as Error).message))}
                hitSlop={8}
              >
                <Text style={{ color: t.sub, fontSize: 14, textDecorationLine: 'underline' }}>보기</Text>
              </Pressable>
            </View>
          ))}
        </View>
        {error ? <Caption style={{ color: t.danger, marginTop: 12 }}>{error}</Caption> : null}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        {!requiredOk ? <Caption style={{ textAlign: 'center' }}>필수 약관에 동의하면 가입할 수 있어요</Caption> : null}
        {providers?.length ? (
          <SocialButtons providers={providers} mode="signup" busy={busy} disabled={!requiredOk} onPress={start} />
        ) : null}
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ alignSelf: 'center', marginTop: 4 }}>
          <Text style={{ color: t.sub, fontSize: 15 }}>
            이미 계정이 있나요? <Text style={{ color: t.primary, fontWeight: '700' }}>로그인</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Check({ on, small }: { on: boolean; small?: boolean }) {
  const t = useTheme();
  const size = small ? 22 : 26;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
        on ? { backgroundColor: t.primary } : { borderWidth: 2, borderColor: t.border },
      ]}
    >
      {on ? <Icon name="check" size={small ? 14 : 16} color={t.onPrimary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginBottom: 8 },
  allRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16 },
  termRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  termToggle: { flex: 1, flexDirection: 'row', alignItems: 'center' },
});
