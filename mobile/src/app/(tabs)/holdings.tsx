import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '@/components/ui';
import { api, type Holding, RANGES } from '@/lib/api';
import { krw, MARKET_LABEL, pct, price, signed } from '@/lib/format';
import { RANGE_LABEL, useRange } from '@/lib/range';
import { changeColor, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

type Sort = 'value' | 'profit' | 'period';
const SORT_LABEL: Record<Sort, string> = { value: '평가액순', profit: '수익률순', period: '기간등락순' };

export default function Holdings() {
  const t = useTheme();
  const { range, setRange } = useRange();
  const [sort, setSort] = useState<Sort>('value');
  const { data, error, loading, reload } = useAsync(() => api.summary(range), [range]);

  const holdings = useMemo(() => {
    const list = [...(data?.holdings ?? [])];
    if (sort === 'profit') list.sort((a, b) => b.profitRate - a.profitRate);
    if (sort === 'period') list.sort((a, b) => (b.periodChangeRate ?? -Infinity) - (a.periodChangeRate ?? -Infinity));
    return list;
  }, [data, sort]);

  return (
    <FlatList
      data={holdings}
      keyExtractor={(h) => `${h.market}:${h.symbol}`}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Segmented options={RANGES} value={range} onChange={setRange} label={(r) => RANGE_LABEL[r]} />
          <Segmented options={['value', 'profit', 'period'] as const} value={sort} onChange={setSort} label={(s) => SORT_LABEL[s]} />
          {error ? <Text style={{ color: t.up }}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        !loading ? <Text style={{ color: t.sub, textAlign: 'center', marginTop: 40 }}>보유 종목이 없습니다.</Text> : undefined
      }
      renderItem={({ item }) => <Row h={item} rangeLabel={RANGE_LABEL[range]} />}
    />
  );
}

function Row({ h, rangeLabel }: { h: Holding; rangeLabel: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: t.card }]}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {h.name}
          {h.stale ? <Text style={{ color: t.sub, fontSize: 11 }}> (이전 데이터)</Text> : null}
        </Text>
        <Text style={[styles.meta, { color: t.sub }]} numberOfLines={1}>
          {MARKET_LABEL[h.market] ?? h.market} · {h.symbol} · {h.quantity.toLocaleString()}주 · 비중 {pct(h.weight)}
        </Text>
        <Text style={[styles.meta, { color: t.sub }]} numberOfLines={1}>
          평균 {price(h.avgPrice, h.currency)} → 현재 {price(h.currentPrice, h.currency)}
        </Text>
        <Text style={[styles.meta, { color: t.sub }]} numberOfLines={1}>
          {h.brokers.join(', ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.name, { color: t.text }]}>{krw(h.valueKrw)}</Text>
        <Text style={{ color: changeColor(t, h.profitKrw), fontSize: 13 }}>
          {signed(h.profitKrw, krw)} ({signed(h.profitRate, pct)})
        </Text>
        {h.periodChangeRate !== null ? (
          <Text style={{ color: changeColor(t, h.periodChangeRate), fontSize: 12, marginTop: 2 }}>
            {rangeLabel} {signed(h.periodChangeRate, pct)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 14, borderRadius: 14, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  meta: { fontSize: 12, marginTop: 1 },
});
