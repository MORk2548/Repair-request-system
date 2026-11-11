import { adminUsersRequestSchema, type AdminUser, type UpdateUserInput } from '../../../packages/core/src/admin.ts';
import type { Role } from '../../../packages/core/src/status.ts';

export type Profile = Omit<AdminUser, 'email'>;

export type Deps = {
  getCaller(token: string): Promise<{ id: string; role: Role; isActive: boolean } | null>;
  listUsers(): Promise<{ id: string; email: string }[]>;
  listProfiles(): Promise<Profile[]>;
  inviteUser(email: string, redirectTo: string): Promise<{ id: string } | 'email_taken'>;
  upsertProfile(profile: Omit<Profile, 'isActive'>): Promise<Profile>;
  updateProfile(userId: string, patch: Omit<UpdateUserInput, 'userId'>): Promise<Profile | null>;
  setBan(userId: string, banned: boolean): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  inviteRedirectTo: string;
};

export type Result = { status: number; body: unknown };

const fail = (status: number, error: string): Result => ({ status, body: { error } });

export async function handle(request: { token: string | null; body: unknown }, deps: Deps): Promise<Result> {
  if (!request.token) return fail(401, 'กรุณาเข้าสู่ระบบ');
  const caller = await deps.getCaller(request.token);
  if (!caller) return fail(401, 'กรุณาเข้าสู่ระบบ');
  if (caller.role !== 'admin' || !caller.isActive) return fail(403, 'คุณไม่มีสิทธิ์ทำรายการนี้');

  const parsed = adminUsersRequestSchema.safeParse(request.body);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
  const input = parsed.data;

  try {
    if (input.action === 'list') {
      const [users, profiles] = await Promise.all([deps.listUsers(), deps.listProfiles()]);
      const emails = new Map(users.map((u) => [u.id, u.email]));
      return { status: 200, body: profiles.map((p): AdminUser => ({ ...p, email: emails.get(p.id) ?? '' })) };
    }

    if (input.action === 'create') {
      // Auth answers a second invite to a not-yet-confirmed address by re-sending it, not with an error
      const users = await deps.listUsers();
      if (users.some((u) => u.email.toLowerCase() === input.email)) return fail(409, 'อีเมลนี้มีผู้ใช้แล้ว');
      const invited = await deps.inviteUser(input.email, deps.inviteRedirectTo);
      if (invited === 'email_taken') return fail(409, 'อีเมลนี้มีผู้ใช้แล้ว');
      let profile: Profile;
      try {
        profile = await deps.upsertProfile({ id: invited.id, displayName: input.displayName, role: input.role, departmentId: input.departmentId });
      } catch (e) {
        // an Auth user without a profile could sign in yet use nothing, and would block inviting the address again
        await deps.deleteUser(invited.id);
        throw e;
      }
      return { status: 200, body: { ...profile, email: input.email } satisfies AdminUser };
    }

    const { action: _, userId, ...patch } = input;
    if (userId === caller.id && (patch.isActive === false || (patch.role !== undefined && patch.role !== 'admin'))) {
      return fail(400, 'ไม่สามารถปิดบัญชีหรือเปลี่ยนบทบาทของตัวเองได้');
    }
    const profile = await deps.updateProfile(userId, patch);
    if (!profile) return fail(404, 'ไม่พบผู้ใช้');
    if (patch.isActive !== undefined) await deps.setBan(userId, !patch.isActive);
    return { status: 200, body: profile };
  } catch (e) {
    console.error(e);
    return fail(500, 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
}
