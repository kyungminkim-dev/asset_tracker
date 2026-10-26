import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { type PickableStock, StockPicker } from '@/components/StockPicker';
import { Caption, Card, EmptyState } from '@/components/ui';
import { api, type NewsItem } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/** 보유 종목 뉴스. "전체"는 평가액 상위 종목 뉴스를 최신순으로, 콤보박스로 고른 종목은 그 종목만 */
export default function News() {
  const t = useTheme();
  const [selected, setSelected] = useState<PickableStock | null>(null); // null = 전체
  const [pickerOpen, setPickerOpen] = useState(false);
  const key = selected ? `${selected.market}:${selected.symbol}` : 'ALL';

  const { data: summary } = useAsync(() => api.summary('range=1M'));
  const stocks: PickableStock[] = (summary?.holdings ?? []).map(({ symbol, market, name }) => ({ symbol, market, name }));
  const { data, error, loading, reload } = useAsync(
    () => api.news(selected ? { symbol: selected.symbol, market: selected.market } : undefined),
    [key],
  );

  const open = (item: NewsItem) =>
    WebBrowser.openBrowserAsync(item.url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor={t.sub} />}
      >
        <View style={styles.filters}>
          <Pressable
            onPress={() => setSelected(null)}
            hitSlop={4}
            style={[styles.allChip, { backgroundColor: selected ? t.card : t.text }]}
            accessibilityRole="button"
            accessibilityState={{ selected: !selected }}
          >
            <Text style={{ color: selected ? t.text2 : t.bg, fontSize: 15, fontWeight: selected ? '500' : '700' }}>전체</Text>
          </Pressable>

          {/* 종목 콤보박스: 누르면 가나다순 목록과 검색이 있는 선택 시트가 열린다 */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={stocks.length === 0}
            style={[
              styles.combo,
              { backgroundColor: t.card, borderColor: selected ? t.text : 'transparent', opacity: stocks.length ? 1 : 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="종목 선택"
          >
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: selected ? t.text : t.sub, fontSize: 15, fontWeight: selected ? '700' : '500' }}
            >
              {selected ? selected.name : '종목 선택'}
            </Text>
            <Icon name="chevron-down" size={18} color={t.sub} />
          </Pressable>
        </View>

        <Card padded={false} style={{ paddingVertical: 6 }}>
          {error ? <Caption style={{ color: t.danger, padding: 22 }}>{error}</Caption> : null}

          {data?.items.map((item, i) => (
            <Pressable
              key={`${item.url}:${i}`}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }]}
            >
              <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.summary ? (
                <Text style={[styles.summary, { color: t.text2 }]} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: t.sub }]} numberOfLines={1}>
                {!selected ? <Text style={{ color: t.primary, fontWeight: '600' }}>{item.name} · </Text> : null}
                {[item.source, timeAgo(item.publishedAt)].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          ))}

          {!loading && !error && data?.items.length === 0 ? (
            <EmptyState
              title={stocks.length ? '관련 뉴스가 없어요' : '보유한 주식이 없어요'}
              description={stocks.length ? undefined : '계좌를 연결하면 보유 종목의 뉴스를 모아 보여드려요.'}
            />
          ) : null}
        </Card>

        {data ? (
          <Caption style={{ textAlign: 'center', marginTop: 4 }}>
            {data.provider.name} 제공{data.provider.notice ? `\n${data.provider.notice}` : ''}
          </Caption>
        ) : null}
      </ScrollView>

      <StockPicker
        visible={pickerOpen}
        stocks={stocks}
        selected={selected}
        onSelect={setSelected}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  allChip: { height: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  combo: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  row: { paddingVertical: 14, paddingHorizontal: 22 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 23, letterSpacing: -0.2 },
  summary: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  meta: { fontSize: 13, marginTop: 6 },
});
