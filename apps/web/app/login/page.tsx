import { AuthShell } from '../../components/AuthShell';
import { LoginForm } from '../../components/LoginForm';
import { getThemeId } from '../../lib/theme';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, theme] = await Promise.all([searchParams, getThemeId()]);
  return (
    <AuthShell theme={theme}>
      {error === 'link' && (
        <p className="notice" role="alert">
          ลิงก์ไม่ถูกต้องหรือหมดอายุ
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
