import { LoginForm } from '../../components/LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <p className="brand">ระบบแจ้งซ่อม</p>
      {error === 'link' && (
        <p className="notice" role="alert">
          ลิงก์ไม่ถูกต้องหรือหมดอายุ
        </p>
      )}
      <LoginForm />
    </main>
  );
}
