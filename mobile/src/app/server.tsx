import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Caption, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { loadServerUrl, saveServerUrl } from '@/lib/settings';
import { useTheme } from '@/lib/theme';

export default function ServerSettings() {
  const t = useTheme();
  const { status, clearLocalSession } = useAuth();
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServerUrl().then((u) => {
      setUrl(u);
      setSavedUrl(u);
    });
  }, []);

  const save = async () => {
    const next = url.trim().replace(/\/+$/, '');
    setSaving(true);
    try {
      await saveServerUrl(next);
      await api.health();
      // 세션은 서버마다 다르므로 서버를 바꾸면 다시 로그인해야 한다
      if (next !== savedUrl && status === 'signedIn') await clearLocalSession();
      setSavedUrl(next);
      router.back();
    } catch (err) {
      Alert.alert('서버에 연결하지 못했어요', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginBottom: 8 }}>
          서버 주소를 알려주세요
        </Text>
        <Caption style={{ marginBottom: 28 }}>
          증권사 API 키는 앱이 아닌 이 서버에 암호화되어 보관돼요. 서버를 바꾸면 다시 로그인해야 해요.
        </Caption>
        <Field
          label="서버 주소"
          placeholder="https://your-server.example.com"
          value={url}
          onChangeText={setUrl}
          keyboardType="url"
          autoFocus
        />
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: 32 }}>
        <Button title="저장" onPress={save} loading={saving} disabled={!url.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}
