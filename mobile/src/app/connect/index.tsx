import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { Avatar, Caption, Card, ListRow } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/** 서버에 등록된 증권사 목록을 그대로 보여준다. 서버에 증권사를 추가하면 앱 수정 없이 나타난다. */
export default function PickBroker() {
  const t = useTheme();
  const { data, error } = useAsync(() => api.brokers());
  const apiBrokers = data?.filter((b) => b.kind === 'api') ?? [];
  const manual = data?.filter((b) => b.kind === 'manual') ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, margin: 12, marginBottom: 20 }}>
        어떤 증권사를{'\n'}연결할까요?
      </Text>
      {error ? <Caption style={{ color: t.danger, margin: 12 }}>{error}</Caption> : null}

      {apiBrokers.length > 0 ? (
        <Card padded={false} style={{ paddingVertical: 8 }}>
          <Caption style={{ paddingHorizontal: 22, paddingTop: 8 }}>자동으로 불러오기</Caption>
          {apiBrokers.map((b) => (
            <ListRow
              key={b.id}
              left={<Avatar label={b.name} colorKey={b.id} />}
              title={b.name}
              subtitle="API 연동 · 매일 자동 업데이트"
              chevron
              onPress={() => router.push({ pathname: '/connect/[brokerId]', params: { brokerId: b.id } })}
            />
          ))}
        </Card>
      ) : null}

      {manual.length > 0 ? (
        <Card padded={false} style={{ paddingVertical: 8 }}>
          <Caption style={{ paddingHorizontal: 22, paddingTop: 8 }}>목록에 없다면</Caption>
          {manual.map((b) => (
            <ListRow
              key={b.id}
              left={<Avatar label="+" colorKey={b.id} />}
              title={b.name}
              subtitle={b.description}
              chevron
              onPress={() => router.push({ pathname: '/connect/[brokerId]', params: { brokerId: b.id } })}
            />
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
