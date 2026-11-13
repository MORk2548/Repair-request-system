import { AuthShell } from '../../components/AuthShell';
import { LoginForm } from '../../components/LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell>
      {error === 'link' && (
        <p className="notice" role="alert">
          ลิงก์ไม่ถูกต้องหรือหมดอายุ
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
