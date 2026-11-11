import { beforeEach, expect, test, vi } from 'vitest';
import { handle, type Deps, type Profile } from './handler.ts';

const ADMIN = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const NEW = '00000000-0000-4000-8000-000000000003';

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: OTHER,
  displayName: 'ช่างหนึ่ง',
  role: 'technician',
  departmentId: null,
  isActive: true,
  ...over,
});

let deps: { [K in keyof Deps]: Deps[K] extends (...a: infer A) => infer R ? ReturnType<typeof vi.fn<(...a: A) => R>> : Deps[K] };

beforeEach(() => {
  deps = {
    getCaller: vi.fn(async () => ({ id: ADMIN, role: 'admin' as const, isActive: true })),
    listUsers: vi.fn(async () => [
      { id: ADMIN, email: 'admin@test.local' },
      { id: OTHER, email: 'tech@test.local' },
    ]),
    listProfiles: vi.fn(async () => [profile({ id: ADMIN, role: 'admin', displayName: 'ผู้ดูแล' }), profile()]),
    inviteUser: vi.fn(async () => ({ id: NEW })),
    upsertProfile: vi.fn(async (p) => ({ ...p, isActive: true })),
    updateProfile: vi.fn(async (id, patch) => ({ ...profile({ id }), ...patch }) as Profile),
    setBan: vi.fn(async () => {}),
    deleteUser: vi.fn(async () => {}),
    inviteRedirectTo: 'http://localhost:3000/auth/confirm',
  };
});

const call = (body: unknown, token: string | null = 'jwt') => handle({ token, body }, deps);
const create = { action: 'create', email: 'New@Test.local ', displayName: 'ผู้ใช้ใหม่', role: 'reporter', departmentId: 2 };
const authDeps = ['listUsers', 'listProfiles', 'inviteUser', 'upsertProfile', 'updateProfile', 'setBan', 'deleteUser'] as const;

test('a request without a token gets 401', async () => {
  expect((await call({ action: 'list' }, null)).status).toBe(401);
  expect(deps.getCaller).not.toHaveBeenCalled();
});

test('non-admin caller gets 403 and no Auth API is called', async () => {
  deps.getCaller.mockResolvedValue({ id: OTHER, role: 'technician', isActive: true });
  expect((await call(create)).status).toBe(403);
  for (const d of authDeps) expect(deps[d]).not.toHaveBeenCalled();
});

test('inactive admin caller gets 403', async () => {
  deps.getCaller.mockResolvedValue({ id: ADMIN, role: 'admin', isActive: false });
  expect((await call({ action: 'list' })).status).toBe(403);
  for (const d of authDeps) expect(deps[d]).not.toHaveBeenCalled();
});

test('an invalid body gets 400 with the Thai validation message', async () => {
  expect(await call({ ...create, displayName: '  ' })).toEqual({ status: 400, body: { error: 'กรุณากรอกชื่อ' } });
  expect((await call({ action: 'drop' })).status).toBe(400);
  expect(deps.inviteUser).not.toHaveBeenCalled();
});

test('list returns profiles joined with their emails', async () => {
  const r = await call({ action: 'list' });
  expect(r).toEqual({
    status: 200,
    body: [
      { ...profile({ id: ADMIN, role: 'admin', displayName: 'ผู้ดูแล' }), email: 'admin@test.local' },
      { ...profile(), email: 'tech@test.local' },
    ],
  });
});

test('create invites the trimmed lower-case email, then writes the profile', async () => {
  const r = await call(create);
  expect(deps.inviteUser).toHaveBeenCalledWith('new@test.local', 'http://localhost:3000/auth/confirm');
  expect(deps.upsertProfile).toHaveBeenCalledWith({ id: NEW, displayName: 'ผู้ใช้ใหม่', role: 'reporter', departmentId: 2 });
  expect(deps.inviteUser.mock.invocationCallOrder[0]).toBeLessThan(deps.upsertProfile.mock.invocationCallOrder[0]!);
  expect(r).toEqual({
    status: 200,
    body: { id: NEW, email: 'new@test.local', displayName: 'ผู้ใช้ใหม่', role: 'reporter', departmentId: 2, isActive: true },
  });
});

test('duplicate email returns Thai error "อีเมลนี้มีผู้ใช้แล้ว"', async () => {
  deps.inviteUser.mockResolvedValue('email_taken');
  expect(await call(create)).toEqual({ status: 409, body: { error: 'อีเมลนี้มีผู้ใช้แล้ว' } });
  expect(deps.upsertProfile).not.toHaveBeenCalled();
});

test('an email already in Auth gets 409 without a new invite, whatever its case', async () => {
  expect(await call({ ...create, email: 'TECH@test.local' })).toEqual({ status: 409, body: { error: 'อีเมลนี้มีผู้ใช้แล้ว' } });
  expect(deps.inviteUser).not.toHaveBeenCalled();
  expect(deps.upsertProfile).not.toHaveBeenCalled();
});

test('a failed profile write deletes the invited user', async () => {
  deps.upsertProfile.mockRejectedValue(new Error('insert failed'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await call(create)).status).toBe(500);
  expect(deps.deleteUser).toHaveBeenCalledWith(NEW);
});

test('admin cannot deactivate their own account (400)', async () => {
  expect(await call({ action: 'update', userId: ADMIN, isActive: false })).toEqual({
    status: 400,
    body: { error: 'ไม่สามารถปิดบัญชีหรือเปลี่ยนบทบาทของตัวเองได้' },
  });
  expect(deps.updateProfile).not.toHaveBeenCalled();
  expect(deps.setBan).not.toHaveBeenCalled();
});

test('admin cannot demote themself but may rename themself', async () => {
  expect((await call({ action: 'update', userId: ADMIN, role: 'technician' })).status).toBe(400);
  expect(deps.updateProfile).not.toHaveBeenCalled();
  expect((await call({ action: 'update', userId: ADMIN, displayName: 'ชื่อใหม่', role: 'admin' })).status).toBe(200);
});

test('deactivating a user also bans them in Auth', async () => {
  const r = await call({ action: 'update', userId: OTHER, isActive: false });
  expect(deps.updateProfile).toHaveBeenCalledWith(OTHER, { isActive: false });
  expect(deps.setBan).toHaveBeenCalledWith(OTHER, true);
  expect(r).toEqual({ status: 200, body: profile({ isActive: false }) });
});

test('reactivating a user lifts the ban', async () => {
  await call({ action: 'update', userId: OTHER, isActive: true });
  expect(deps.setBan).toHaveBeenCalledWith(OTHER, false);
});

test('an update without isActive leaves the ban alone', async () => {
  await call({ action: 'update', userId: OTHER, role: 'admin', departmentId: null });
  expect(deps.updateProfile).toHaveBeenCalledWith(OTHER, { role: 'admin', departmentId: null });
  expect(deps.setBan).not.toHaveBeenCalled();
});
