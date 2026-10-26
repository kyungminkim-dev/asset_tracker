import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Caption, Chips, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

/** 증권사의 credentialFields 로 입력 폼을 자동 생성한다 */
export default function ConnectBroker() {
  const t = useTheme();
  const { brokerId } = useLocalSearchParams<{ brokerId: string }>();
  const { data: brokers } = useAsync(() => api.brokers());
  const broker = brokers?.find((b) => b.id === brokerId);

  const [label, setLabel] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!broker) return null;
  const value = (key: string) => values[key] ?? broker.credentialFields.find((f) => f.key === key)?.options?.[0]?.value ?? '';
  const missing = broker.credentialFields.some((f) => !f.optional && !value(f.key).trim());

  const submit = async () => {
    setSaving(true);
    try {
      const credentials = Object.fromEntries(broker.credentialFields.map((f) => [f.key, value(f.key)]));
      const conn = await api.createConnection(broker.id, label || broker.name, credentials);
      if (conn.kind === 'manual') {
        router.replace({ pathname: '/manual/[id]', params: { id: conn.id, label: conn.label } });
      } else {
        router.dismissTo('/connections');
      }
    } catch (err) {
      Alert.alert('연결하지 못했어요', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isApi = broker.kind === 'api';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginBottom: 8 }}>
          {isApi ? `${broker.name} 연결` : '직접 입력할 계좌 만들기'}
        </Text>
        {broker.description ? <Caption style={{ marginBottom: 28 }}>{broker.description}</Caption> : null}

        <Field
          label="계좌 이름"
          placeholder={isApi ? broker.name : '예: 삼성증권 ISA'}
          value={label}
          onChangeText={setLabel}
        />

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

        {isApi ? (
          <Caption>입력한 키는 내 서버에만 암호화되어 저장되고, 저장 전에 잔고를 한 번 조회해 연결을 확인해요.</Caption>
        ) : null}
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: 32 }}>
        <Button title={isApi ? '연결하기' : '만들기'} onPress={submit} loading={saving} disabled={missing} />
      </View>
    </KeyboardAvoidingView>
  );
}
