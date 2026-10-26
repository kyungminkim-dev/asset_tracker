import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { Button, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { loadSettings, saveSettings } from '@/lib/settings';
import { useTheme } from '@/lib/theme';

export default function Settings() {
  const t = useTheme();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setUrl(s.url);
      setToken(s.token);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({ url, token });
      await api.connections(); // 토큰까지 확인
      router.back();
    } catch (err) {
      Alert.alert('연결 확인 실패', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: t.sub, marginBottom: 16 }}>
        증권사 API 키는 앱이 아닌 내 서버에 보관됩니다. 서버 주소와 서버의 APP_TOKEN 을 입력하세요.
      </Text>
      <Field label="서버 주소" placeholder="http://192.168.0.10:4000" value={url} onChangeText={setUrl} keyboardType="url" />
      <Field label="접근 토큰 (APP_TOKEN)" secureTextEntry value={token} onChangeText={setToken} />
      <Button title="저장" onPress={save} loading={saving} />
    </ScrollView>
  );
}
