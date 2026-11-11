import { createBrowserClient } from '@supabase/ssr';
import type { Database, Db } from '@repair/api';
import { supabaseAnonKey, supabaseUrl } from './env';

export const createBrowserDb = (): Db => createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
