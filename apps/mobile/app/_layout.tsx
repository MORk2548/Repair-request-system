import type { Session } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { styles } from '../components/ui';
import { envError } from '../lib/env';
import { db } from '../lib/supabase';

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
  const session = useSession();

  if (envError) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <Text accessibilityRole="alert" style={[styles.error, { fontSize: 18 }]}>
          {envError}
        </Text>
      </View>
    );
  }
  if (session === undefined) {
    return (
      <View style={[styles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" accessibilityLabel="กำลังโหลด" />
      </View>
    );
  }

  // a guard that turns false sends the user to the first screen they may open, so signing in or out needs no redirect code
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tickets/new" options={{ title: 'แจ้งซ่อม', headerBackTitle: 'กลับ' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
