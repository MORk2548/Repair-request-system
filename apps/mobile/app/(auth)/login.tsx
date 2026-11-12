import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Button, Field, styles } from '../../components/ui';
import { db } from '../../lib/supabase';

// the root layout moves to the ticket list when the session appears, so success needs no navigation here
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    setFailed(false);
    try {
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={[styles.screen, { justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>
          เข้าสู่ระบบ
        </Text>
        <Field label="อีเมล" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label="รหัสผ่าน" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
        {failed ? <Alert>อีเมลหรือรหัสผ่านไม่ถูกต้อง</Alert> : null}
        <Button label="เข้าสู่ระบบ" onPress={() => void submit()} disabled={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
