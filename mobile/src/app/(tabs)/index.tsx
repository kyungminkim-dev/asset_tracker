import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '@/components/LineChart';
import { AllocationBar, Button, Card, Chips, EmptyState, InfoRow, SectionTitle } from '@/components/ui';
import { api, type HistoryPoint, RANGES } from '@/lib/api';
import { krw, pct, signed } from '@/lib/format';
import { RANGE_LABEL, useRange } from '@/lib/range';
import { changeColor, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Home() {
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
      if (failed.length) Alert.alert('일부 계좌를 불러오지 못했어요', failed.map((c) => `${c.label}: ${c.error}`).join('\n'));
      await reload();
    } catch (err) {
      Alert.alert('불러오기 실패', (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  if (error && !summary) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <EmptyState
          title="자산을 불러오지 못했어요"
          description={error}
          action={<Button title="서버 설정 확인" variant="weak" size="medium" onPress={() => router.push('/server')} />}
        />
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
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={t.sub} />}
    >
      <Card>
        <View style={styles.totalHeader}>
          <Text style={{ color: t.sub, fontSize: 15, fontWeight: '500' }}>
            {scrub ? scrub.date : '총 자산'}
          </Text>
          <Button title="새로고침" icon="refresh" variant="neutral" size="small" onPress={sync} loading={syncing} />
        </View>
        <Text style={[styles.total, { color: t.text }]}>{shown ? krw(shown.value) : '0원'}</Text>
        <Text style={{ color, fontSize: 15, fontWeight: '600', marginBottom: 20 }}>
          {RANGE_LABEL[range]} 전보다 {signed(delta, krw)} ({signed(rate, pct)})
        </Text>

        <LineChart points={points} color={color} onScrub={setScrub} height={180} />

        <View style={{ marginTop: 16 }}>
          <Chips options={RANGES} value={range} onChange={setRange} label={(r) => RANGE_LABEL[r]} stretch />
        </View>
      </Card>

      {summary ? (
        <>
          <Card>
            <SectionTitle>투자 현황</SectionTitle>
            <InfoRow label="주식 평가금액" value={krw(summary.stockValue)} />
            <InfoRow label="예수금" value={krw(summary.cash)} />
            <InfoRow label="투자 원금" value={krw(summary.totalCost)} />
            <InfoRow
              label="평가 손익"
              value={signed(summary.profit, krw)}
              sub={`(${signed(summary.profitRate, pct)})`}
              valueColor={changeColor(t, summary.profit)}
            />
          </Card>

          <Card>
            <SectionTitle>시장별 비중</SectionTitle>
            <AllocationBar groups={summary.byMarket} />
          </Card>

          <Card>
            <SectionTitle>계좌별 비중</SectionTitle>
            <AllocationBar groups={summary.byBroker} labelOf={(k) => k} />
          </Card>

          <Text style={[styles.footnote, { color: t.sub }]}>
            {summary.asOf} 기준{summary.fx.USD ? ` · 1달러 ${krw(summary.fx.USD)}` : ''}
          </Text>
        </>
      ) : !loading ? (
        <Card>
          <EmptyState
            title="아직 모은 자산이 없어요"
            description="증권사 계좌를 연결하면 한곳에서 볼 수 있어요."
            action={<Button title="계좌 연결하기" size="medium" onPress={() => router.push('/connect')} />}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  totalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 4, marginBottom: 6 },
  footnote: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
