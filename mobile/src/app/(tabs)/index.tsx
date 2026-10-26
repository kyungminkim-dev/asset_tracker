import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CurrencyToggle } from '@/components/CurrencyToggle';
import { LineChart } from '@/components/LineChart';
import { PeriodChips } from '@/components/PeriodChips';
import { AllocationBar, Button, Card, EmptyState, InfoRow, SectionTitle } from '@/components/ui';
import { api, type HistoryPoint } from '@/lib/api';
import { useMoney } from '@/lib/currency';
import { krw, pct, signed } from '@/lib/format';
import { periodPhrase, periodQuery, usePeriod } from '@/lib/range';
import { changeColor, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Home() {
  const t = useTheme();
  const { period } = usePeriod();
  const query = periodQuery(period);
  const [scrub, setScrub] = useState<HistoryPoint | null>(null);
  const [syncing, setSyncing] = useState(false);
  const m = useMoney();

  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.summary(query), api.history(query), api.connections()]),
    [query],
  );
  const [summary, history, connections] = data ?? [];

  // 로그인 후 연결된 계좌가 하나도 없으면 자산 연결 화면을 한 번 띄운다
  const prompted = useRef(false);
  useEffect(() => {
    if (connections && connections.length === 0 && !prompted.current) {
      prompted.current = true;
      router.push('/connect');
    }
  }, [connections]);

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

  // 달러로 볼 때는 날짜마다 그날 환율로 바꾼다. 환율이 빠진 날이 있으면 원화로 보여준다
  const raw = history?.points ?? [];
  const convertible = raw.every((p) => p.usdKrw);
  const points = raw.map((p) => ({
    ...p,
    value: convertible ? m.convert(p.value, p.usdKrw) : p.value,
    cost: convertible ? m.convert(p.cost, p.usdKrw) : p.cost,
  }));
  const fmt = m.formatter(convertible);
  const latest = points[points.length - 1];

  // 그래프를 짚고 있으면 그 날짜 기준 값으로 보여준다
  const shown = scrub ?? (latest && summary?.asOf === latest.date ? latest : null);
  const start = points[0]?.value ?? 0;
  const delta = shown && start ? shown.value - start : summary ? m.convert(summary.change.amount, summary.usdKrw) : 0;
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CurrencyToggle />
            <Button title="새로고침" icon="refresh" variant="neutral" size="small" onPress={sync} loading={syncing} />
          </View>
        </View>
        <Text style={[styles.total, { color: t.text }]}>
          {shown ? fmt.full(shown.value) : summary ? m.money(summary.totalValue, summary.usdKrw) : fmt.full(0)}
        </Text>
        <Text style={{ color, fontSize: 15, fontWeight: '600', marginBottom: 20 }}>
          {periodPhrase(period)} {signed(delta, fmt.full)} ({signed(rate, pct)})
        </Text>

        <LineChart points={points} color={color} onScrub={setScrub} height={180} format={fmt} />

        <View style={{ marginTop: 16 }}>
          <PeriodChips />
        </View>
      </Card>

      {summary ? (
        <>
          <Card>
            <SectionTitle>투자 현황</SectionTitle>
            <InfoRow label="주식 평가금액" value={m.money(summary.stockValue, summary.usdKrw)} />
            <InfoRow label="예수금" value={m.money(summary.cash, summary.usdKrw)} />
            <InfoRow label="투자 원금" value={m.money(summary.totalCost, summary.usdKrw)} />
            <InfoRow
              label="평가 손익"
              value={m.moneySigned(summary.profit, summary.usdKrw)}
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
            {summary.asOf} 기준{summary.usdKrw ? ` · 1달러 ${krw(summary.usdKrw)}` : ''}
          </Text>
        </>
      ) : !loading ? (
        <Card>
          <EmptyState
            title="아직 모은 자산이 없어요"
            description="증권사 계좌를 연결하면 한곳에서 볼 수 있어요."
            action={<Button title="자산 연결하기" size="medium" onPress={() => router.push('/connect')} />}
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
