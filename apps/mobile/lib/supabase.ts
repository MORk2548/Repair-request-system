import type { Database, Db } from '@repair/api';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { encryptedStorage } from './encryptedStorage';
import { envError, supabaseAnonKey, supabaseUrl } from './env';

// with a missing variable the root layout shows envError and never renders a screen that uses db
export const db: Db = createClient<Database>(envError ? 'http://invalid.localhost' : supabaseUrl, envError ? 'missing' : supabaseAnonKey, {
  auth: { storage: encryptedStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// refresh tokens only while the app is in the foreground, as Supabase's React Native guide does
AppState.addEventListener('change', (state) => {
  if (state === 'active') void db.auth.startAutoRefresh();
  else void db.auth.stopAutoRefresh();
});
