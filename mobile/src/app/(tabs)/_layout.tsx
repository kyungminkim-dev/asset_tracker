import { Link, Tabs } from 'expo-router';
import { type ColorValue, Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const t = useTheme();
  const tabIcon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: t.bg },
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.sub,
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable hitSlop={12} style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: t.sub, fontSize: 18 }}>⚙︎</Text>
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: '내 자산', tabBarIcon: tabIcon('◔') }} />
      <Tabs.Screen name="holdings" options={{ title: '보유 종목', tabBarIcon: tabIcon('☰') }} />
      <Tabs.Screen name="connections" options={{ title: '증권사', tabBarIcon: tabIcon('⛓︎') }} />
    </Tabs>
  );
}
