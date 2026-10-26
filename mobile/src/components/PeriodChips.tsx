import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { RANGES } from '@/lib/api';
import { periodLabel, RANGE_LABEL, usePeriod } from '@/lib/range';
import { useTheme } from '@/lib/theme';
import { Icon } from './Icon';

/**
 * 기간 선택 칩: 1주 ~ 전체 + 직접 선택.
 * 화면 폭에 억지로 나누면 "1개월"처럼 긴 글자가 줄바꿈되므로 가로 스크롤로 두고 글자는 항상 한 줄로 쓴다.
 */
export function PeriodChips() {
  const t = useTheme();
  const { period, setRange } = usePeriod();
  const custom = period.range === 'CUSTOM';

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {RANGES.map((r) => {
        const on = period.range === r;
        return (
          <Pressable key={r} onPress={() => setRange(r)} hitSlop={4} style={[styles.chip, on && { backgroundColor: t.fill }]}>
            <Text numberOfLines={1} style={[styles.text, { color: on ? t.text : t.sub, fontWeight: on ? '700' : '500' }]}>
              {RANGE_LABEL[r]}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => router.push('/period')}
        hitSlop={4}
        style={[styles.chip, styles.customChip, custom && { backgroundColor: t.primaryWeak }]}
        accessibilityLabel="기간 직접 선택"
      >
        <Icon name="calendar" size={15} color={custom ? t.primaryWeakText : t.sub} />
        <Text numberOfLines={1} style={[styles.text, { color: custom ? t.primaryWeakText : t.sub, fontWeight: custom ? '700' : '500' }]}>
          {custom ? periodLabel(period) : '직접 선택'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingRight: 4 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  customChip: { flexDirection: 'row', gap: 5 },
  text: { fontSize: 14 },
});
