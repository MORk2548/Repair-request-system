import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '../../components/ui';
import { signOut } from '../../lib/push';
import { db } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

function SignOutButton() {
  const { userId } = useProfile();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="ออกจากระบบ"
      onPress={() => void signOut(db, userId)}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 16, justifyContent: 'center' }}
    >
      <Text style={{ color: colors.primary, fontSize: 16 }}>ออกจากระบบ</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerRight: () => <SignOutButton />, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="tickets" options={{ title: 'ใบแจ้งซ่อม', tabBarLabel: 'ใบแจ้งซ่อม', tabBarIcon: () => null }} />
    </Tabs>
  );
}
