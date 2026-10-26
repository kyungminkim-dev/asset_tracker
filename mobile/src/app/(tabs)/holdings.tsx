import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { PeriodChips } from '@/components/PeriodChips';
import { Avatar, Card, Chips, EmptyState, ListRow } from '@/components/ui';
import { api, type Holding } from '@/lib/api';
import { krw, MARKET_LABEL, pct, price, signed } from '@/lib/format';
import { periodLabel, periodQuery, usePeriod } from '@/lib/range';
import { changeColor, useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

type Sort = 'value' | 'profit' | 'period';
const SORT_LABEL: Record<Sort, string> = { value: '평가금액순', profit: '수익률순', period: '기간 등락순' };

export default function Holdings() {
  const t = useTheme();
  const { period } = usePeriod();
  const query = periodQuery(period);
  const [sort, setSort] = useState<Sort>('value');
  const { data, error, loading, reload } = useAsync(() => api.summary(query), [query]);

  const holdings = useMemo(() => {
    const list = [...(data?.holdings ?? [])];
    if (sort === 'profit') list.sort((a, b) => b.profitRate - a.profitRate);
    if (sort === 'period') list.sort((a, b) => (b.periodChangeRate ?? -Infinity) - (a.periodChangeRate ?? -Infinity));
    return list;
  }, [data, sort]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={t.sub} />}
    >
      {data ? (
        <Card>
          <Text style={{ color: t.sub, fontSize: 15 }}>주식 평가금액</Text>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>
            {krw(data.stockValue)}
          </Text>
          <Text style={{ color: changeColor(t, data.profit), fontSize: 15, fontWeight: '600', marginTop: 4 }}>
            {signed(data.profit, krw)} ({signed(data.profitRate, pct)})
          </Text>
        </Card>
      ) : null}

      <Card padded={false} style={{ paddingVertical: 12 }}>
        <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 6 }}>
          <PeriodChips />
          <Chips options={['value', 'profit', 'period'] as const} value={sort} onChange={setSort} label={(s) => SORT_LABEL[s]} />
        </View>

        {error ? <Text style={{ color: t.danger, paddingHorizontal: 22, paddingVertical: 8 }}>{error}</Text> : null}

        {holdings.map((h) => (
          <HoldingRow key={`${h.market}:${h.symbol}`} h={h} sort={sort} rangeLabel={periodLabel(period)} />
        ))}

        {!loading && holdings.length === 0 ? (
          <EmptyState title="보유한 주식이 없어요" description="계좌를 연결하고 새로고침하면 여기에 모여요." />
        ) : null}
      </Card>
    </ScrollView>
  );
}

function HoldingRow({ h, sort, rangeLabel }: { h: Holding; sort: Sort; rangeLabel: string }) {
  const t = useTheme();
  // 기간 등락순으로 볼 때는 오른쪽 아래에 기간 등락률을 보여준다
  const showPeriod = sort === 'period' && h.periodChangeRate !== null;
  const subValue = showPeriod ? h.periodChangeRate! : h.profitKrw;
  return (
    <ListRow
      left={<Avatar label={h.name} colorKey={h.symbol} />}
      title={h.name + (h.stale ? ' · 이전 데이터' : '')}
      subtitle={`${MARKET_LABEL[h.market] ?? h.market} · ${h.quantity.toLocaleString()}주 · ${price(h.currentPrice, h.currency)}`}
      right={krw(h.valueKrw)}
      rightSub={
        showPeriod
          ? `${rangeLabel} ${signed(h.periodChangeRate!, pct)}`
          : `${signed(h.profitKrw, krw)} (${signed(h.profitRate, pct)})`
      }
      rightSubColor={changeColor(t, subValue)}
    />
  );
}
