import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

/**
 * 로그인 후 …/auth?code=... 로 돌아오는 자리.
 * iOS 는 openAuthSessionAsync 가 주소를 받아 처리하지만, 안드로이드에서는 라우터가 먼저 이 화면을 열 수 있어
 * 여기서도 로그인을 마무리한다. (같은 코드는 completeSignIn 이 한 번만 처리한다)
 * 로그인 전에 "/" 로 보내면 Stack.Protected 가 다시 튕겨내 무한 루프가 생기므로 상태에 따라 나눈다.
 */
export default function AuthCallback() {
  const t = useTheme();
  const { status, completeSignIn } = useAuth();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const [failed, setFailed] = useState(!code && !error);

  useEffect(() => {
    if (!code && !error) return;
    completeSignIn({ code, error }).catch((err) => {
      Alert.alert('로그인하지 못했어요', (err as Error).message);
      setFailed(true);
    });
  }, [code, error, completeSignIn]);

  if (status === 'signedIn') return <Redirect href="/" />;
  if (failed) return <Redirect href="/login" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <ActivityIndicator color={t.sub} />
    </View>
  );
}
