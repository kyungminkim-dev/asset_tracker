import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Field, Segmented } from '@/components/ui';
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
      Alert.alert('연결 실패', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: broker.name }} />
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {broker.description ? <Text style={{ color: t.sub, marginBottom: 16 }}>{broker.description}</Text> : null}

        <Field
          label="이름"
          placeholder={broker.kind === 'manual' ? '예: 삼성증권 ISA' : broker.name}
          value={label}
          onChangeText={setLabel}
        />

        {broker.credentialFields.map((f) =>
          f.options ? (
            <View key={f.key} style={{ marginBottom: 14 }}>
              <Text style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>{f.label}</Text>
              <Segmented
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

        {broker.kind === 'api' ? (
          <Text style={{ color: t.sub, fontSize: 12, marginBottom: 16 }}>
            입력한 키는 내 서버에만 암호화되어 저장되며, 저장 전에 잔고 조회로 연결을 확인합니다.
          </Text>
        ) : null}

        <Button title={broker.kind === 'api' ? '연결 확인 후 저장' : '만들기'} onPress={submit} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
