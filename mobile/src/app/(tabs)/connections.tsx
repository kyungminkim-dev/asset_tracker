import { router } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '@/components/ui';
import { api, type Connection } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Connections() {
  const t = useTheme();
  const { data, error, loading, reload } = useAsync(() => api.connections());

  const remove = (c: Connection) =>
    Alert.alert('연결 삭제', `${c.label} 연결을 삭제할까요?\n과거 스냅샷 기록은 유지됩니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteConnection(c.id);
            reload();
          } catch (err) {
            Alert.alert('삭제 실패', (err as Error).message);
          }
        },
      },
    ]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
    >
      {error ? <Text style={{ color: t.up, marginBottom: 12 }}>{error}</Text> : null}

      {data?.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => c.kind === 'manual' && router.push({ pathname: '/manual/[id]', params: { id: c.id, label: c.label } })}
          onLongPress={() => remove(c)}
        >
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: t.text }]}>{c.label}</Text>
                <Text style={{ color: t.sub, fontSize: 12 }}>
                  {c.brokerName}
                  {c.lastSyncedAt ? ` · 마지막 동기화 ${new Date(c.lastSyncedAt).toLocaleString('ko-KR')}` : ' · 아직 동기화 안 됨'}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: c.lastError ? t.up : c.lastSyncedAt ? '#10B981' : t.sub }]} />
            </View>
            {c.lastError ? (
              <Text style={{ color: t.up, fontSize: 12, marginTop: 8 }} numberOfLines={3}>
                {c.lastError}
              </Text>
            ) : null}
            {c.kind === 'manual' ? (
              <Text style={{ color: t.primary, fontSize: 13, marginTop: 8 }}>탭해서 보유 종목 편집 ›</Text>
            ) : null}
          </Card>
        </Pressable>
      ))}

      {data && data.length > 0 ? (
        <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginBottom: 12 }}>길게 눌러 연결 삭제</Text>
      ) : null}

      <Button title="+ 증권사 추가" onPress={() => router.push('/connect')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  badge: { width: 10, height: 10, borderRadius: 5 },
});
