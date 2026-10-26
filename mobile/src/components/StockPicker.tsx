import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MARKET_LABEL } from '@/lib/format';
import { compareKorean, matchesStock } from '@/lib/search';
import { useTheme } from '@/lib/theme';
import { Icon } from './Icon';
import { Avatar, EmptyState } from './ui';

export interface PickableStock {
  symbol: string;
  market: string;
  name: string;
}

const keyOf = (s: PickableStock) => `${s.market}:${s.symbol}`;

/** 종목 선택 시트: 가나다순 목록 + 이름·코드·초성 검색 */
export function StockPicker({
  visible,
  stocks,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  stocks: PickableStock[];
  selected: PickableStock | null;
  onSelect: (s: PickableStock) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');

  const list = useMemo(
    () => stocks.filter((s) => matchesStock(query, s)).sort((a, b) => compareKorean(a.name, b.name)),
    [stocks, query],
  );

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaProvider>
        <SafeAreaView edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']} style={{ flex: 1, backgroundColor: t.bg }}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>종목 선택</Text>
            <Pressable onPress={close} hitSlop={12} accessibilityLabel="닫기">
              <Icon name="close" size={24} color={t.sub} />
            </Pressable>
          </View>

          <View style={[styles.search, { backgroundColor: t.fill }]}>
            <Icon name="search" size={18} color={t.sub} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="종목명, 코드, 초성으로 검색"
              placeholderTextColor={t.sub}
              keyboardAppearance={t.scheme}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={{ flex: 1, color: t.text, fontSize: 16 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="검색어 지우기">
                <Icon name="close" size={16} color={t.sub} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={list}
            keyExtractor={keyOf}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={<EmptyState title={query ? '검색 결과가 없어요' : '보유한 종목이 없어요'} />}
            renderItem={({ item }) => {
              const on = !!selected && keyOf(selected) === keyOf(item);
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    close();
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }]}
                >
                  <Avatar label={item.name} colorKey={item.symbol} />
                  <View style={{ flex: 1, marginHorizontal: 14 }}>
                    <Text style={[styles.name, { color: on ? t.primary : t.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>
                      {MARKET_LABEL[item.market] ?? item.market} · {item.symbol}
                    </Text>
                  </View>
                  {on ? <Icon name="check" size={22} color={t.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, height: 48, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  name: { fontSize: 16, fontWeight: '600' },
});
