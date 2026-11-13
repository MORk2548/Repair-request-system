import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useUi } from '../../components/ui';
import { signOut } from '../../lib/push';
import { db } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

function SignOutButton() {
  const { userId } = useProfile();
  const { colors } = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="ออกจากระบบ"
      onPress={() => void signOut(db, userId)}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' }}
    >
      <Text style={{ color: colors.link, fontSize: 16 }}>ออกจากระบบ</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors } = useUi();
  return (
    <Tabs
      screenOptions={{
        headerRight: () => <SignOutButton />,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="tickets" options={{ title: 'ใบแจ้งซ่อม', tabBarLabel: 'ใบแจ้งซ่อม', tabBarIcon: () => null }} />
      <Tabs.Screen name="settings" options={{ title: 'ตั้งค่า', tabBarLabel: 'ตั้งค่า', tabBarIcon: () => null }} />
    </Tabs>
  );
}
