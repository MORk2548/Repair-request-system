import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { useUi } from '../components/ui';
import { envError } from '../lib/env';
import { registerPushToken, useNotificationTaps } from '../lib/push';
import { db } from '../lib/supabase';
import { ThemeProvider, useTheme } from '../lib/theme';
import { ProfileProvider } from '../lib/useProfile';

function useSession() {
  // undefined while the stored session is still being read
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (envError) return;
    db.auth.getSession().then(
      ({ data }) => setSession(data.session),
      () => setSession(null),
    );
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const { theme } = useTheme();
  const { styles, colors } = useUi();
  const session = useSession();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    registerPushToken(db, userId).catch((e) => console.warn('push registration failed', e));
  }, [userId]);
  useNotificationTaps(userId !== null);

  if (envError) {
    return (
      <Screen style={[styles.screen, { justifyContent: 'center' }]}>
        <Text accessibilityRole="alert" style={[styles.error, { fontSize: 18 }]}>
          {envError}
        </Text>
      </Screen>
    );
  }
  if (session === undefined) {
    return (
      <Screen style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="กำลังโหลด" />
      </Screen>
    );
  }

  // a guard that turns false sends the user to the first screen they may open, so signing in or out needs no redirect code
  return (
    <ProfileProvider userId={userId}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tickets/new" options={{ title: 'แจ้งซ่อม', headerBackTitle: 'กลับ' }} />
          <Stack.Screen name="tickets/[id]" options={{ title: '', headerBackTitle: 'กลับ' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ProfileProvider>
  );
}
