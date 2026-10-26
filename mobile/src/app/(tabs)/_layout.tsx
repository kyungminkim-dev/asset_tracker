import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/lib/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={24} color={color} />;
  };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: t.bg },
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, borderTopWidth: 0.5 },
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.sub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', headerTitle: '내 자산', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="holdings" options={{ title: '주식', headerTitle: '보유 주식', tabBarIcon: tabIcon('chart') }} />
      <Tabs.Screen name="news" options={{ title: '뉴스', headerTitle: '내 종목 뉴스', tabBarIcon: tabIcon('news') }} />
      <Tabs.Screen name="connections" options={{ title: '계좌', headerTitle: '연결된 계좌', tabBarIcon: tabIcon('wallet') }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: tabIcon('menu') }} />
    </Tabs>
  );
}
