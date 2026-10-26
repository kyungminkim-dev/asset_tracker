import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Caption, Card, ListRow } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

type SyncState = { status: 'running' } | { status: 'done'; failed: string[] } | { status: 'error'; message: string };

/** 자산 연결 마지막 단계: 연결 결과를 보여주고 바로 자산을 불러온다 */
export default function ConnectDone() {
  const t = useTheme();
  const { done } = useLocalSearchParams<{ done?: string }>();
  const ids = done ? done.split(',').filter(Boolean) : [];
  const { data: connections } = useAsync(() => api.connections());
  const created = (connections ?? []).filter((c) => ids.includes(c.id));
  const [sync, setSync] = useState<SyncState | null>(ids.length ? { status: 'running' } : null);

  // 연결한 계좌가 있으면 바로 한 번 불러와 홈에 자산이 보이게 한다
  const hasNew = ids.length > 0;
  useEffect(() => {
    if (!hasNew) return;
    api
      .sync()
      .then((r) => setSync({ status: 'done', failed: r.connections.filter((c) => !c.ok).map((c) => `${c.label}: ${c.error}`) }))
      .catch((err) => setSync({ status: 'error', message: (err as Error).message }));
  }, [hasNew]);

  const manual = created.filter((c) => c.kind === 'manual');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 32 }}>
        <View style={{ marginHorizontal: 12, marginBottom: 24 }}>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.7 }}>
            {ids.length ? '자산 연결을\n마쳤어요' : '연결한 증권사가\n없어요'}
          </Text>
          <Caption style={{ marginTop: 8 }}>
            {ids.length ? '연결한 계좌는 매일 장 마감 후 자동으로 업데이트돼요.' : '언제든 계좌 탭에서 다시 연결할 수 있어요.'}
          </Caption>
        </View>

        {created.length > 0 ? (
          <Card padded={false} style={{ paddingVertical: 8 }}>
            {created.map((c) => (
              <ListRow
                key={c.id}
                left={<Avatar label={c.brokerId === 'manual' ? c.label : c.brokerName} colorKey={c.brokerId === 'manual' ? c.label : c.brokerId} />}
                title={c.label}
                subtitle={c.kind === 'manual' ? '보유 종목을 입력해 주세요' : '자동 연결됨'}
                chevron={c.kind === 'manual'}
                onPress={
                  c.kind === 'manual'
                    ? () => router.push({ pathname: '/manual/[id]', params: { id: c.id, label: c.label } })
                    : undefined
                }
              />
            ))}
          </Card>
        ) : null}

        {sync ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 8 }}>
            {sync.status === 'running' ? <ActivityIndicator color={t.sub} /> : null}
            <Caption style={{ color: sync.status === 'error' || (sync.status === 'done' && sync.failed.length) ? t.danger : t.sub, textAlign: 'center' }}>
              {sync.status === 'running'
                ? '자산을 불러오는 중이에요'
                : sync.status === 'error'
                  ? `자산을 불러오지 못했어요: ${sync.message}`
                  : sync.failed.length
                    ? `일부를 불러오지 못했어요\n${sync.failed.join('\n')}`
                    : '자산을 불러왔어요'}
            </Caption>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 32, gap: 8 }}>
        {manual.length === 1 ? (
          <Button
            title="보유 종목 입력하기"
            variant="weak"
            onPress={() => router.push({ pathname: '/manual/[id]', params: { id: manual[0]!.id, label: manual[0]!.label } })}
          />
        ) : null}
        <Button title="홈으로" onPress={() => router.dismissTo('/')} />
      </View>
    </View>
  );
}
