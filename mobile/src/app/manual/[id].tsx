import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, Segmented, SectionTitle } from '@/components/ui';
import { api, type ManualPosition } from '@/lib/api';
import { MARKET_LABEL, price } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

const MARKETS = ['KR', 'US', 'JP', 'HK', 'CN', 'OTHER'] as const;
const DEFAULT_CURRENCY: Record<string, string> = { KR: 'KRW', US: 'USD', JP: 'JPY', HK: 'HKD', CN: 'CNY', OTHER: 'KRW' };

const empty = { symbol: '', name: '', market: 'KR', currency: 'KRW', quantity: '', avgPrice: '', currentPrice: '' };

export default function ManualPositions() {
  const t = useTheme();
  const { id, label } = useLocalSearchParams<{ id: string; label?: string }>();
  const { data, reload } = useAsync(() => api.manualPositions(id), [id]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const edit = (p: ManualPosition) => {
    setEditing(p.id);
    setForm({
      symbol: p.symbol, name: p.name, market: p.market, currency: p.currency,
      quantity: String(p.quantity), avgPrice: String(p.avg_price), currentPrice: String(p.current_price),
    });
  };

  const save = async () => {
    const quantity = Number(form.quantity);
    const avgPrice = Number(form.avgPrice);
    const currentPrice = Number(form.currentPrice || form.avgPrice);
    if (!form.symbol || !(quantity > 0) || !(avgPrice >= 0) || Number.isNaN(currentPrice)) {
      Alert.alert('입력 확인', '종목코드, 수량, 평균단가를 올바르게 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.saveManualPosition(id, { ...form, quantity, avgPrice, currentPrice }, editing);
      setForm(empty);
      setEditing(undefined);
      reload();
    } catch (err) {
      Alert.alert('저장 실패', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: ManualPosition) =>
    Alert.alert('삭제', `${p.name} 을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => api.deleteManualPosition(id, p.id).then(reload) },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: label ?? '보유 종목 입력' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {data?.map((p) => (
          <Pressable key={p.id} onPress={() => edit(p)} onLongPress={() => remove(p)}>
            <Card style={{ paddingVertical: 12 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>
                {p.name} <Text style={{ color: t.sub, fontWeight: '400' }}>{p.symbol}</Text>
              </Text>
              <Text style={{ color: t.sub, fontSize: 12 }}>
                {MARKET_LABEL[p.market]} · {p.quantity}주 · 평균 {price(p.avg_price, p.currency)} · 현재 {price(p.current_price, p.currency)}
              </Text>
            </Card>
          </Pressable>
        ))}
        {data && data.length > 0 ? (
          <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginBottom: 12 }}>탭: 수정 · 길게: 삭제</Text>
        ) : null}

        <Card>
          <SectionTitle>{editing ? '종목 수정' : '종목 추가'}</SectionTitle>
          <View style={{ marginBottom: 14 }}>
            <Segmented
              options={MARKETS}
              value={form.market as (typeof MARKETS)[number]}
              onChange={(m) => setForm((f) => ({ ...f, market: m, currency: DEFAULT_CURRENCY[m]! }))}
              label={(m) => MARKET_LABEL[m]!}
            />
          </View>
          <Field label="종목코드" placeholder="005930 / AAPL" value={form.symbol} onChangeText={set('symbol')} autoCapitalize="characters" />
          <Field label="종목명" placeholder="삼성전자" value={form.name} onChangeText={set('name')} />
          <Field label="통화" value={form.currency} onChangeText={set('currency')} autoCapitalize="characters" />
          <Field label="수량" keyboardType="decimal-pad" value={form.quantity} onChangeText={set('quantity')} />
          <Field label="평균단가" keyboardType="decimal-pad" value={form.avgPrice} onChangeText={set('avgPrice')} />
          <Field
            label="현재가"
            keyboardType="decimal-pad"
            value={form.currentPrice}
            onChangeText={set('currentPrice')}
            help="비워두면 평균단가로 저장됩니다. 시세 자동 반영은 추후 지원 예정."
          />
          <Button title={editing ? '수정 저장' : '추가'} onPress={save} loading={saving} />
          {editing ? (
            <View style={{ marginTop: 8 }}>
              <Button title="취소" variant="ghost" onPress={() => { setEditing(undefined); setForm(empty); }} />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
