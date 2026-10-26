import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar, Button, Caption, Card, EmptyState } from '@/components/ui';
import { api, type Broker } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/**
 * 자산 연결: 서버에 등록된 증권사 전체를 보여주고, 여러 곳을 골라 차례로 연결한다.
 * 서버에 증권사를 추가하면 앱 수정 없이 이 목록에 나타난다.
 */
export default function ConnectAssets() {
  const t = useTheme();
  const { data, error } = useAsync(() => Promise.all([api.brokers(), api.connections()]));
  const [brokers, connections] = data ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const connectedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of connections ?? []) m.set(c.brokerId, (m.get(c.brokerId) ?? 0) + 1);
    return m;
  }, [connections]);

  const filtered = (brokers ?? []).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
  const apiBrokers = filtered.filter((b) => b.kind === 'api');
  const manualBrokers = filtered.filter((b) => b.kind === 'manual');

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const start = () => {
    // 목록 순서대로 (API 연동 증권사 먼저) 하나씩 연결한다
    const ids = (brokers ?? []).filter((b) => selected.has(b.id)).map((b) => b.id);
    const [first, ...rest] = ids;
    if (!first) return;
    router.push({
      pathname: '/connect/[brokerId]',
      params: { brokerId: first, queue: rest.join(','), done: '', step: '1', total: String(ids.length) },
    });
  };

  const renderRow = (b: Broker) => {
    const on = selected.has(b.id);
    const count = connectedCount.get(b.id) ?? 0;
    return (
      <Pressable
        key={b.id}
        onPress={() => toggle(b.id)}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
      >
        <Avatar label={b.name} colorKey={b.id} />
        <View style={{ flex: 1, marginHorizontal: 14 }}>
          <Text style={[styles.name, { color: t.text }]}>{b.name}</Text>
          <Text style={{ color: count ? t.primary : t.sub, fontSize: 13, marginTop: 2 }}>
            {count ? `연결됨${count > 1 ? ` ${count}개` : ''} · 계좌 추가 가능` : b.kind === 'api' ? '매일 자동으로 불러와요' : '보유 종목을 직접 입력해요'}
          </Text>
        </View>
        <View style={[styles.check, on ? { backgroundColor: t.primary } : { borderColor: t.border, borderWidth: 2 }]}>
          {on ? <Icon name="check" size={16} color={t.onPrimary} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginHorizontal: 12, marginBottom: 20 }}>
          <Text style={[styles.title, { color: t.text }]}>자산 연결</Text>
          <Caption style={{ marginTop: 6 }}>
            주식이 있는 증권사를 모두 골라주세요.{'\n'}선택한 곳을 차례로 연결해 한곳에 모아드려요.
          </Caption>
        </View>

        <View style={[styles.search, { backgroundColor: t.card }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="증권사 이름 검색"
            placeholderTextColor={t.sub}
            keyboardAppearance={t.scheme}
            autoCorrect={false}
            style={{ flex: 1, color: t.text, fontSize: 16 }}
            clearButtonMode="while-editing"
          />
        </View>

        {error ? <Caption style={{ color: t.danger, margin: 12 }}>{error}</Caption> : null}

        {apiBrokers.length > 0 ? (
          <Card padded={false} style={{ paddingVertical: 8 }}>
            <Text style={[styles.group, { color: t.sub }]}>자동 연결</Text>
            {apiBrokers.map(renderRow)}
          </Card>
        ) : null}

        {manualBrokers.length > 0 ? (
          <Card padded={false} style={{ paddingVertical: 8 }}>
            <Text style={[styles.group, { color: t.sub }]}>직접 입력</Text>
            {manualBrokers.map(renderRow)}
          </Card>
        ) : null}

        {brokers && filtered.length === 0 ? (
          <Card>
            <EmptyState title="찾는 증권사가 없어요" description="'기타 증권사'를 골라 직접 입력할 수 있어요." />
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: t.bg }]}>
        <Button
          title={selected.size ? `${selected.size}개 증권사 연결하기` : '증권사를 선택해 주세요'}
          onPress={start}
          disabled={selected.size === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  search: { borderRadius: 16, height: 50, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  group: { fontSize: 13, fontWeight: '600', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 22 },
  name: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
});
