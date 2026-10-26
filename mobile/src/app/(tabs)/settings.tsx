import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar, Caption, Card, ListRow, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CURRENCY_LABEL, useCurrency } from '@/lib/currency';
import { type LegalDoc, openLegal } from '@/lib/legal';
import { loadServerUrl } from '@/lib/settings';
import { THEME_LABEL, type ThemePreference, useTheme, useThemePreference } from '@/lib/theme';

const PROVIDER_LABEL: Record<string, string> = { google: '구글', kakao: '카카오' };
const THEME_ICON: Record<ThemePreference, IconName> = { system: 'phone', light: 'sun', dark: 'moon' };

export default function Settings() {
  const t = useTheme();
  const { preference, setPreference } = useThemePreference();
  const { currency, setCurrency } = useCurrency();
  const { user, signOut, deleteAccount } = useAuth();
  const [server, setServer] = useState('');

  useEffect(() => {
    loadServerUrl().then(setServer);
  }, []);

  const confirmSignOut = () =>
    Alert.alert('로그아웃할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', onPress: () => signOut().catch(() => {}) },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      '정말 탈퇴할까요?',
      '연결한 증권사 키, 직접 입력한 종목, 모든 자산 기록이 바로 삭제되고 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (err) {
              Alert.alert('탈퇴하지 못했어요', (err as Error).message);
            }
          },
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      {user ? (
        <Card style={styles.profile}>
          <Avatar label={user.displayName} colorKey={user.id} size={52} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 19, fontWeight: '700' }} numberOfLines={1}>
              {user.displayName}
            </Text>
            <Caption>
              {user.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(', ')} 계정
              {user.email ? ` · ${user.email}` : ''}
            </Caption>
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>화면 모드</SectionTitle>
        {(['system', 'light', 'dark'] as const).map((p) => {
          const on = preference === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPreference(p)}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <View style={[styles.optionIcon, { backgroundColor: t.fill }]}>
                <Icon name={THEME_ICON[p]} size={20} color={on ? t.primary : t.sub} />
              </View>
              <Text style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: on ? '700' : '500' }}>{THEME_LABEL[p]}</Text>
              {on ? <Icon name="check" size={22} color={t.primary} /> : null}
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <SectionTitle>표시 통화</SectionTitle>
        {(['KRW', 'USD'] as const).map((c) => {
          const on = currency === c;
          return (
            <Pressable
              key={c}
              onPress={() => setCurrency(c)}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <View style={[styles.optionIcon, { backgroundColor: t.fill }]}>
                <Text style={{ color: on ? t.primary : t.sub, fontSize: 17, fontWeight: '700' }}>{c === 'KRW' ? '₩' : '$'}</Text>
              </View>
              <Text style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: on ? '700' : '500' }}>{CURRENCY_LABEL[c]}</Text>
              {on ? <Icon name="check" size={22} color={t.primary} /> : null}
            </Pressable>
          );
        })}
        <Caption style={{ marginTop: 6 }}>달러로 볼 때는 날짜마다 그날의 환율로 바꿔서 보여줘요.</Caption>
      </Card>

      <Card padded={false} style={{ paddingVertical: 8 }}>
        <ListRow
          left={<RowIcon name="server" />}
          title="서버 설정"
          subtitle={server || '설정되지 않음'}
          chevron
          onPress={() => router.push('/server')}
        />
        <ListRow left={<RowIcon name="logout" />} title="로그아웃" onPress={confirmSignOut} />
        <ListRow left={<RowIcon name="trash" danger />} title="회원 탈퇴" titleColor={t.danger} onPress={confirmDelete} />
      </Card>

      <Card padded={false} style={{ paddingVertical: 8 }}>
        <ListRow title="서비스 이용약관" chevron onPress={() => showLegal('terms')} />
        <ListRow title="개인정보 처리방침" chevron onPress={() => showLegal('privacy')} />
      </Card>

      <Caption style={{ textAlign: 'center', marginTop: 8 }}>버전 {Constants.expoConfig?.version ?? '-'}</Caption>
    </ScrollView>
  );
}

const showLegal = (doc: LegalDoc) =>
  openLegal(doc).catch((err) => Alert.alert('문서를 열 수 없어요', (err as Error).message));

function RowIcon({ name, danger }: { name: IconName; danger?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.optionIcon, { backgroundColor: danger ? t.dangerWeak : t.fill, marginRight: 0 }]}>
      <Icon name={name} size={20} color={danger ? t.danger : t.text2} />
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
});
