import { router } from 'expo-router';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { Avatar, Button, Caption, Card, EmptyState, ListRow } from '@/components/ui';
import { api, type Connection } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

function statusText(c: Connection) {
  if (c.lastError) return `불러오기 실패 · ${c.lastError}`;
  if (c.lastSyncedAt) return `${new Date(c.lastSyncedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })} 업데이트`;
  return c.kind === 'manual' ? '직접 입력 · 탭해서 종목 추가' : '아직 불러오지 않았어요';
}

export default function Connections() {
  const t = useTheme();
  const { data, error, loading, reload } = useAsync(() => api.connections());

  const openActions = (c: Connection) =>
    Alert.alert(c.label, undefined, [
      ...(c.kind === 'manual'
        ? [{ text: '종목 편집', onPress: () => router.push({ pathname: '/manual/[id]', params: { id: c.id, label: c.label } }) }]
        : []),
      {
        text: '연결 해제',
        style: 'destructive' as const,
        onPress: () =>
          Alert.alert('연결을 해제할까요?', '과거 자산 기록은 그대로 남아요.', [
            { text: '취소', style: 'cancel' },
            {
              text: '해제',
              style: 'destructive',
              onPress: async () => {
                try {
                  await api.deleteConnection(c.id);
                  reload();
                } catch (err) {
                  Alert.alert('해제하지 못했어요', (err as Error).message);
                }
              },
            },
          ]),
      },
      { text: '닫기', style: 'cancel' as const },
    ]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={t.sub} />}
    >
      {error ? <Caption style={{ color: t.danger, margin: 12 }}>{error}</Caption> : null}

      <Card padded={false} style={{ paddingVertical: 8 }}>
        {data?.map((c) => (
          <ListRow
            key={c.id}
            left={<Avatar label={c.brokerName === '직접 입력' ? c.label : c.brokerName} colorKey={c.brokerId} />}
            title={c.label}
            subtitle={statusText(c)}
            chevron
            onPress={() =>
              c.kind === 'manual'
                ? router.push({ pathname: '/manual/[id]', params: { id: c.id, label: c.label } })
                : openActions(c)
            }
            onLongPress={() => openActions(c)}
          />
        ))}
        {data?.length === 0 ? (
          <EmptyState title="연결된 계좌가 없어요" description="증권사를 연결하면 보유 주식을 자동으로 불러와요." />
        ) : null}
        <View style={{ paddingHorizontal: 22, paddingVertical: 12 }}>
          <Button title="계좌 연결하기" icon="plus" variant="weak" size="medium" onPress={() => router.push('/connect')} />
        </View>
      </Card>

      {data && data.length > 0 ? (
        <Caption style={{ textAlign: 'center' }}>길게 누르면 연결을 해제할 수 있어요</Caption>
      ) : null}
    </ScrollView>
  );
}
