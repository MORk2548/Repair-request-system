import { AuthShell } from '../../components/AuthShell';
import { SetPasswordForm } from '../../components/SetPasswordForm';
import { getThemeId } from '../../lib/theme';

export default async function SetPasswordPage() {
  return (
    <AuthShell theme={await getThemeId()}>
      <SetPasswordForm />
    </AuthShell>
  );
}
