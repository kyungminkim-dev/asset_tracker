import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '@/components/LineChart';
import { AllocationBar, Button, Card, Segmented, SectionTitle } from '@/components/ui';
import { api, type HistoryPoint, RANGES } from '@/lib/api';
import { krw, pct, signed } from '@/lib/format';
import { RANGE_LABEL, useRange } from '@/lib/range';
import { changeColor, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Dashboard() {
  const t = useTheme();
  const { range, setRange } = useRange();
  const [scrub, setScrub] = useState<HistoryPoint | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.summary(range), api.history(range)]),
    [range],
  );
  const [summary, history] = data ?? [];

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await api.sync();
      const failed = result.connections.filter((c) => !c.ok);
      if (failed.length) Alert.alert('일부 증권사 동기화 실패', failed.map((c) => `${c.label}: ${c.error}`).join('\n'));
      await reload();
    } catch (err) {
      Alert.alert('동기화 실패', (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  if (error && !summary) {
    return (
      <View style={styles.center}>
        <Text style={{ color: t.sub, marginBottom: 16, textAlign: 'center' }}>{error}</Text>
        <Button title="서버 설정" onPress={() => router.push('/settings')} />
      </View>
    );
  }

  // 그래프를 짚고 있으면 그 날짜 기준 값으로 보여준다
  const points = history?.points ?? [];
  const shown = scrub ?? (summary ? { date: summary.asOf, value: summary.totalValue } : null);
  const start = points[0]?.value ?? 0;
  const delta = shown && start ? shown.value - start : (summary?.change.amount ?? 0);
  const rate = shown && start ? delta / start : (summary?.change.rate ?? 0);
  const color = changeColor(t, delta);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
    >
      <Card>
        <Text style={{ color: t.sub, fontSize: 13 }}>
          총 자산 {shown ? `· ${shown.date}` : ''}
        </Text>
        <Text style={[styles.total, { color: t.text }]}>{shown ? krw(shown.value) : '-'}</Text>
        <Text style={{ color, fontWeight: '600', marginBottom: 16 }}>
          {RANGE_LABEL[range]} {signed(delta, krw)} ({signed(rate, pct)})
        </Text>

        <LineChart points={points} color={color} onScrub={setScrub} />

        <View style={{ marginTop: 16 }}>
          <Segmented options={RANGES} value={range} onChange={setRange} label={(r) => RANGE_LABEL[r]} />
        </View>
      </Card>

      {summary ? (
        <>
          <Card>
            <View style={styles.statRow}>
              <Stat label="주식 평가액" value={krw(summary.stockValue)} />
              <Stat label="예수금" value={krw(summary.cash)} />
            </View>
            <View style={[styles.statRow, { marginTop: 14 }]}>
              <Stat label="매입금액" value={krw(summary.totalCost)} />
              <Stat
                label="평가손익"
                value={`${signed(summary.profit, krw)}`}
                sub={signed(summary.profitRate, pct)}
                color={changeColor(t, summary.profit)}
              />
            </View>
          </Card>

          <Card>
            <SectionTitle>시장별 비중</SectionTitle>
            <AllocationBar groups={summary.byMarket} />
          </Card>

          <Card>
            <SectionTitle>증권사별 비중</SectionTitle>
            <AllocationBar groups={summary.byBroker} labelOf={(k) => k} />
          </Card>

          {summary.fx.USD ? (
            <Text style={[styles.footnote, { color: t.sub }]}>
              {summary.asOf} 기준 · USD {krw(summary.fx.USD)} 환율 적용
            </Text>
          ) : null}
        </>
      ) : !loading ? (
        <Card>
          <Text style={{ color: t.sub, marginBottom: 12 }}>
            아직 스냅샷이 없어요. 증권사를 연결한 뒤 동기화하세요.
          </Text>
          <Button title="증권사 연결하기" variant="ghost" onPress={() => router.push('/connect')} />
        </Card>
      ) : null}

      <Button title="지금 동기화" onPress={sync} loading={syncing} />
    </ScrollView>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.sub, fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: color ?? t.text, fontSize: 15, fontWeight: '700' }}>{value}</Text>
      {sub ? <Text style={{ color: color ?? t.sub, fontSize: 12 }}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  total: { fontSize: 30, fontWeight: '800', marginVertical: 4 },
  statRow: { flexDirection: 'row' },
  footnote: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
});
