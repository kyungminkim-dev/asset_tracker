import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AuthProvider } from '@/lib/api';
import { Button } from './ui';

type Id = AuthProvider['id'];

const LABEL: Record<'login' | 'signup', Record<Id, string>> = {
  login: { kakao: '카카오 로그인', google: 'Google 계정으로 로그인', dev: '테스트 계정으로 로그인 (개발용)' },
  signup: { kakao: '카카오로 가입하기', google: 'Google 계정으로 가입하기', dev: '테스트 계정으로 가입하기 (개발용)' },
};

/** 서버에 설정된 소셜 로그인 버튼들. 카카오 → 구글 → (개발용) 순서 */
export function SocialButtons({
  providers,
  mode,
  busy,
  disabled,
  onPress,
}: {
  providers: AuthProvider[];
  mode: 'login' | 'signup';
  busy: Id | null;
  disabled?: boolean;
  onPress: (id: Id) => void;
}) {
  const has = (id: Id) => providers.some((p) => p.id === id);
  const off = disabled || !!busy;
  return (
    <View style={{ gap: 12 }}>
      {has('kakao') ? (
        // 카카오 로그인 디자인 가이드: #FEE500 배경, 85% 검정 글자, 말풍선 심볼
        <Pressable
          onPress={() => onPress('kakao')}
          disabled={off}
          style={({ pressed }) => [styles.button, { backgroundColor: '#FEE500', opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
        >
          {busy === 'kakao' ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Svg width={18} height={18} viewBox="0 0 24 24" style={styles.icon}>
                <Path
                  fill="#000"
                  d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.88 5.32 4.7 6.73l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.5.06 1 .1 1.52.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"
                />
              </Svg>
              <Text style={[styles.text, { color: 'rgba(0,0,0,0.85)' }]}>{LABEL[mode].kakao}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {has('google') ? (
        <Pressable
          onPress={() => onPress('google')}
          disabled={off}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0', opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          {busy === 'google' ? (
            <ActivityIndicator color="#1F1F1F" />
          ) : (
            <>
              <Svg width={18} height={18} viewBox="0 0 48 48" style={styles.icon}>
                <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </Svg>
              <Text style={[styles.text, { color: '#1F1F1F' }]}>{LABEL[mode].google}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {/* 서버가 DEV_LOGIN=true 일 때만 내려온다 */}
      {has('dev') ? (
        <Button title={LABEL[mode].dev} variant="neutral" onPress={() => onPress('dev')} loading={busy === 'dev'} disabled={off && busy !== 'dev'} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 8 },
  text: { fontSize: 17, fontWeight: '600' },
});
