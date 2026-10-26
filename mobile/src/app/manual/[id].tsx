import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Caption, Card, Chips, EmptyState, Field, ListRow, SectionTitle } from '@/components/ui';
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

  const cancel = () => {
    setEditing(undefined);
    setForm(empty);
  };

  const save = async () => {
    const quantity = Number(form.quantity);
    const avgPrice = Number(form.avgPrice);
    const currentPrice = Number(form.currentPrice || form.avgPrice);
    if (!form.symbol || !(quantity > 0) || !(avgPrice >= 0) || Number.isNaN(currentPrice)) {
      Alert.alert('입력을 확인해 주세요', '종목코드, 수량, 평균단가를 올바르게 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.saveManualPosition(id, { ...form, quantity, avgPrice, currentPrice }, editing);
      cancel();
      reload();
    } catch (err) {
      Alert.alert('저장하지 못했어요', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: ManualPosition) =>
    Alert.alert(`${p.name}을(를) 삭제할까요?`, undefined, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => api.deleteManualPosition(id, p.id).then(reload) },
    ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, margin: 12, marginBottom: 20 }}>
          {label ?? '보유 종목'}
        </Text>

        <Card padded={false} style={{ paddingVertical: 8 }}>
          {data?.map((p) => (
            <ListRow
              key={p.id}
              left={<Avatar label={p.name} colorKey={p.symbol} />}
              title={p.name}
              subtitle={`${MARKET_LABEL[p.market]} · ${p.quantity}주 · 평균 ${price(p.avg_price, p.currency)}`}
              right={price(p.current_price, p.currency)}
              rightSub="현재가"
              onPress={() => edit(p)}
              onLongPress={() => remove(p)}
            />
          ))}
          {data?.length === 0 ? <EmptyState title="아직 입력한 종목이 없어요" description="아래에서 보유 종목을 추가하세요." /> : null}
        </Card>
        {data && data.length > 0 ? <Caption style={{ textAlign: 'center', marginBottom: 12 }}>탭하면 수정, 길게 누르면 삭제</Caption> : null}

        <Card>
          <SectionTitle>{editing ? '종목 수정' : '종목 추가'}</SectionTitle>
          <View style={{ marginBottom: 20 }}>
            <Chips
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
            help="비워두면 평균단가로 저장돼요."
          />
          <View style={{ gap: 8 }}>
            <Button title={editing ? '수정하기' : '추가하기'} onPress={save} loading={saving} />
            {editing ? <Button title="취소" variant="neutral" onPress={cancel} /> : null}
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
