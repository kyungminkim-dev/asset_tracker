import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Caption } from '@/components/ui';
import { usePeriod } from '@/lib/range';
import { useTheme } from '@/lib/theme';

type Field = 'from' | 'to';

/** 기기 시간대 기준 YYYY-MM-DD */
function toYmd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const display = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

/** 기간 직접 선택: 시작일과 종료일을 골라 그 기간의 자산 변화를 본다 */
export default function PeriodPicker() {
  const t = useTheme();
  const { period, setCustom } = usePeriod();
  const today = new Date();
  const [from, setFrom] = useState(() =>
    period.range === 'CUSTOM' ? fromYmd(period.from) : new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
  );
  const [to, setTo] = useState(() => (period.range === 'CUSTOM' ? fromYmd(period.to) : today));
  const [editing, setEditing] = useState<Field>('from');

  const limits = (field: Field) =>
    field === 'from' ? { maximumDate: to } : { minimumDate: from, maximumDate: today };

  const onPick = (field: Field, date?: Date) => {
    if (!date) return;
    if (field === 'from') setFrom(date);
    else setTo(date);
  };

  const open = (field: Field) => {
    setEditing(field);
    // 안드로이드는 화면 안에 달력을 넣지 않고 시스템 날짜 선택 창을 띄운다
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: field === 'from' ? from : to,
        mode: 'date',
        ...limits(field),
        onValueChange: (_event, date) => onPick(field, date),
      });
    }
  };

  const apply = () => {
    setCustom(toYmd(from), toYmd(to));
    router.back();
  };

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={[styles.title, { color: t.text }]}>기간을 직접 골라주세요</Text>
        <Caption style={{ marginBottom: 24 }}>선택한 기간 동안 자산이 얼마나 변했는지 보여드려요.</Caption>

        <View style={styles.fields}>
          {(['from', 'to'] as const).map((field) => {
            const on = Platform.OS === 'ios' && editing === field;
            return (
              <Pressable
                key={field}
                onPress={() => open(field)}
                style={[styles.field, { backgroundColor: t.fill, borderColor: on ? t.primary : 'transparent' }]}
              >
                <Text style={{ color: t.sub, fontSize: 13, marginBottom: 4 }}>{field === 'from' ? '시작일' : '종료일'}</Text>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
                  {display(field === 'from' ? from : to)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Caption style={{ textAlign: 'center', marginTop: 12 }}>{days}일</Caption>

        {Platform.OS === 'ios' ? (
          <DateTimePicker
            key={editing}
            value={editing === 'from' ? from : to}
            mode="date"
            display="inline"
            locale="ko-KR"
            themeVariant={t.scheme}
            accentColor={t.primary}
            {...limits(editing)}
            onValueChange={(_e, date) => onPick(editing, date)}
            style={{ marginTop: 16 }}
          />
        ) : null}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 32 }}>
        <Button title="이 기간으로 보기" onPress={apply} disabled={from > to} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginBottom: 8 },
  fields: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, borderRadius: 14, padding: 14, borderWidth: 2 },
});
