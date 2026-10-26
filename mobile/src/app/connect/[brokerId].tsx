import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Caption, Chips, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

type Params = { brokerId: string; queue?: string; done?: string; step?: string; total?: string };

const split = (s?: string) => (s ? s.split(',').filter(Boolean) : []);

/**
 * 선택한 증권사를 하나씩 연결하는 단계 화면.
 * queue: 남은 증권사 id, done: 지금까지 만든 연결 id. 마지막 단계가 끝나면 완료 화면으로 간다.
 * 입력 폼은 증권사의 credentialFields 로 자동 생성한다.
 */
export default function ConnectStep() {
  const t = useTheme();
  const params = useLocalSearchParams<Params>();
  const { brokerId } = params;
  const queue = split(params.queue);
  const done = split(params.done);
  const step = Number(params.step ?? 1);
  const total = Number(params.total ?? 1);

  const { data: brokers } = useAsync(() => api.brokers());
  const broker = brokers?.find((b) => b.id === brokerId);

  const [label, setLabel] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!broker) return null;
  const value = (key: string) => values[key] ?? broker.credentialFields.find((f) => f.key === key)?.options?.[0]?.value ?? '';
  const missing = broker.credentialFields.some((f) => !f.optional && !value(f.key).trim());
  const isApi = broker.kind === 'api';

  const next = (connectionId?: string) => {
    const doneNext = connectionId ? [...done, connectionId] : done;
    const [nextId, ...rest] = queue;
    if (nextId) {
      router.replace({
        pathname: '/connect/[brokerId]',
        params: { brokerId: nextId, queue: rest.join(','), done: doneNext.join(','), step: String(step + 1), total: String(total) },
      });
    } else {
      router.replace({ pathname: '/connect/done', params: { done: doneNext.join(',') } });
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const credentials = Object.fromEntries(broker.credentialFields.map((f) => [f.key, value(f.key)]));
      const conn = await api.createConnection(broker.id, label.trim() || broker.name, credentials);
      next(conn.id);
    } catch (err) {
      Alert.alert('연결하지 못했어요', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {total > 1 ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 4 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: t.fill, overflow: 'hidden' }}>
            <View style={{ width: `${(step / total) * 100}%`, height: 4, backgroundColor: t.primary }} />
          </View>
          <Caption style={{ marginTop: 8 }}>
            {step} / {total}
          </Caption>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Avatar label={broker.name} colorKey={broker.id} size={48} />
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginTop: 16, marginBottom: 8 }}>
          {isApi ? `${broker.name} 계좌를\n연결할게요` : `${broker.name} 계좌를\n만들게요`}
        </Text>
        {broker.description ? <Caption style={{ marginBottom: 28 }}>{broker.description}</Caption> : null}

        <Field label="계좌 이름" placeholder={broker.name} value={label} onChangeText={setLabel} help="비워두면 증권사 이름으로 저장돼요." />

        {broker.credentialFields.map((f) =>
          f.options ? (
            <View key={f.key} style={{ marginBottom: 20 }}>
              <Text style={{ color: t.text2, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{f.label}</Text>
              <Chips
                options={f.options.map((o) => o.value)}
                value={value(f.key)}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                label={(v) => f.options!.find((o) => o.value === v)?.label ?? v}
              />
            </View>
          ) : (
            <Field
              key={f.key}
              label={f.optional ? `${f.label} (선택)` : f.label}
              placeholder={f.placeholder}
              help={f.help}
              secureTextEntry={f.secret}
              value={value(f.key)}
              onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
          ),
        )}

        <Caption>
          {isApi
            ? '입력한 키는 내 서버에만 암호화되어 저장되고, 저장 전에 잔고를 한 번 조회해 연결을 확인해요.'
            : '보유 종목은 연결을 마친 뒤 입력할 수 있어요.'}
        </Caption>
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: 32, gap: 8 }}>
        <Button title={isApi ? '연결하기' : '계좌 만들기'} onPress={submit} loading={saving} disabled={missing} />
        {total > 1 ? <Button title="이 증권사는 건너뛰기" variant="neutral" onPress={() => next()} disabled={saving} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
