// Expo inlines EXPO_PUBLIC_ variables only where they are read as literal property accesses
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const missing = [!supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL', !supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY'].filter(Boolean);

export const envError =
  missing.length > 0
    ? `ตั้งค่าแอปไม่ครบ: ไม่พบ ${missing.join(' และ ')} ในไฟล์ apps/mobile/.env (คัดลอกจาก .env.example) แล้วเริ่ม Expo ใหม่`
    : null;
