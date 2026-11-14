import { beforeAll, expect, test } from 'vitest';
import {
  AdminError,
  DuplicateAssetTagError,
  adminCreateUser,
  adminListUsers,
  adminUpdateUser,
  saveCategory,
  saveDepartment,
  saveEquipment,
} from '../src/index';
import { newUser, service, signIn, type TestUser } from './helpers';

let reporter: TestUser, admin: TestUser;
const tag = crypto.randomUUID().slice(0, 8);

beforeAll(async () => {
  [reporter, admin] = await Promise.all([newUser('reporter'), newUser('admin')]);
});

const equipment = {
  assetTag: `${tag}-EQ`,
  name: 'front 01',
  model: 'OptiPlex 3070',
  serialNo: '  ',
  monitorModel: 'HP P19',
  monitorSerialNo: '6CM4191G2Y',
  userName: 'พี่มณี',
  departmentId: null,
  installLocation: 'ห้อง 1',
  status: 'active' as const,
};

test('admin adds and renames a department, then switches it off', async () => {
  const added = await saveDepartment(admin.db, { name: `แผนก ${tag}`, isActive: true });
  expect(added).toEqual({ id: expect.any(Number), name: `แผนก ${tag}`, isActive: true });
  expect(await saveDepartment(admin.db, { id: added.id, name: `แผนกใหม่ ${tag}`, isActive: false })).toEqual({
    id: added.id,
    name: `แผนกใหม่ ${tag}`,
    isActive: false,
  });
});

test('admin saves a category with its sort order', async () => {
  const added = await saveCategory(admin.db, { name: `หมวด ${tag}`, sortOrder: 7, isActive: true });
  expect(await saveCategory(admin.db, { ...added, sortOrder: 3 })).toMatchObject({ id: added.id, sortOrder: 3 });
});

test('a reporter cannot add or change lookups', async () => {
  const { id } = await saveCategory(admin.db, { name: `ล็อก ${tag}`, sortOrder: 0, isActive: true });
  await expect(saveCategory(reporter.db, { name: 'x', sortOrder: 0, isActive: true })).rejects.toMatchObject({ cause: { code: '42501' } });
  await expect(saveCategory(reporter.db, { id, name: 'x', sortOrder: 0, isActive: false })).rejects.toThrow();
  await expect(saveDepartment(reporter.db, { name: 'x', isActive: true })).rejects.toMatchObject({ cause: { code: '42501' } });
  await expect(saveEquipment(reporter.db, { ...equipment, assetTag: `${tag}-R` })).rejects.toMatchObject({ cause: { code: '42501' } });
  const { data } = await service.from('categories').select('name, is_active').eq('id', id).single();
  expect(data).toEqual({ name: `ล็อก ${tag}`, is_active: true });
});

test('saveEquipment stores the PC, its monitor and its user, a blank serial as null, and refuses a duplicate asset tag', async () => {
  const added = await saveEquipment(admin.db, equipment);
  expect(added).toMatchObject({
    assetTag: `${tag}-EQ`,
    model: 'OptiPlex 3070',
    serialNo: null,
    monitorModel: 'HP P19',
    monitorSerialNo: '6CM4191G2Y',
    userName: 'พี่มณี',
    installLocation: 'ห้อง 1',
    status: 'active',
  });
  expect(await saveEquipment(admin.db, { ...added, status: 'retired' })).toMatchObject({ id: added.id, status: 'retired' });
  await expect(saveEquipment(admin.db, equipment)).rejects.toBeInstanceOf(DuplicateAssetTagError);
});

test('adminListUsers returns profiles with emails for an admin and 403 for a reporter', async () => {
  const users = await adminListUsers(admin.db);
  expect(users.find((u) => u.id === reporter.id)).toMatchObject({ email: reporter.email, role: 'reporter', isActive: true });
  await expect(adminListUsers(reporter.db)).rejects.toMatchObject({ name: 'AdminError', status: 403 });
});

test('adminCreateUser invites a user and refuses the same email again', async () => {
  const email = `invite-${tag}@test.local`;
  const created = await adminCreateUser(admin.db, { email, displayName: 'ผู้ถูกเชิญ', role: 'technician', departmentId: null });
  expect(created).toMatchObject({ email, displayName: 'ผู้ถูกเชิญ', role: 'technician', isActive: true });
  const err = await adminCreateUser(admin.db, { email, displayName: 'ซ้ำ', role: 'reporter', departmentId: null }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AdminError);
  expect(err).toMatchObject({ status: 409, message: 'อีเมลนี้มีผู้ใช้แล้ว' });
});

test('a deactivated user cannot sign in until reactivated', async () => {
  const user = await newUser('reporter');
  expect(await adminUpdateUser(admin.db, { userId: user.id, isActive: false })).toMatchObject({ isActive: false });
  expect((await signIn(user)).error).not.toBeNull();
  await adminUpdateUser(admin.db, { userId: user.id, isActive: true });
  expect((await signIn(user)).error).toBeNull();
});

test('an admin cannot deactivate themself', async () => {
  await expect(adminUpdateUser(admin.db, { userId: admin.id, isActive: false })).rejects.toMatchObject({
    status: 400,
    message: 'ไม่สามารถปิดบัญชีหรือเปลี่ยนบทบาทของตัวเองได้',
  });
});
