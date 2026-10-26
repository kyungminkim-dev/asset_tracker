import { router } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/** 서버에 등록된 증권사 목록을 그대로 보여준다. 서버에 증권사를 추가하면 앱 수정 없이 나타난다. */
export default function PickBroker() {
  const t = useTheme();
  const { data, error } = useAsync(() => api.brokers());

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {error ? <Text style={{ color: t.up }}>{error}</Text> : null}
      {data?.map((b) => (
        <Pressable key={b.id} onPress={() => router.push({ pathname: '/connect/[brokerId]', params: { brokerId: b.id } })}>
          <Card>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
              {b.name} {b.kind === 'api' ? '· 자동 동기화' : ''}
            </Text>
            {b.description ? <Text style={{ color: t.sub, fontSize: 13 }}>{b.description}</Text> : null}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
