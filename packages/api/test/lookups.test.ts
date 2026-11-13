import { beforeAll, expect, test } from 'vitest';
import { getAccount, getProfile, savePushToken, listCategories, listDepartments, listEquipment, listTechnicians } from '../src/index';
import { newCategory, newUser, service, type TestUser } from './helpers';

let reporter: TestUser, tech: TestUser, admin: TestUser;
let active: number, inactive: number;
const tag = crypto.randomUUID().slice(0, 8);

beforeAll(async () => {
  [reporter, tech, admin] = await Promise.all([newUser('reporter'), newUser('technician'), newUser('admin')]);
  [active, inactive] = await Promise.all([newCategory(true), newCategory(false)]);
  const { error } = await service.from('equipment').insert([
    { asset_tag: `${tag}-AC-01`, name: 'แอร์ ห้อง 101', install_location: 'ตึก A ห้อง 101', status: 'active' },
    { asset_tag: `${tag}-PR-01`, name: `เครื่องพิมพ์ 50%, ชั้น (2) ${tag}`, status: 'active' },
    { asset_tag: `${tag}-PR-02`, name: `เครื่องพิมพ์ 50x ชั้น 2 ${tag}`, status: 'active' },
    { asset_tag: `${tag}-OLD`, name: 'เครื่องเก่า', status: 'retired' },
  ]);
  if (error) throw error;
});

test('listCategories leaves out inactive categories unless includeInactive is set', async () => {
  const ids = (await listCategories(reporter.db)).map((c) => c.id);
  expect(ids).toContain(active);
  expect(ids).not.toContain(inactive);
  expect((await listCategories(admin.db)).map((c) => c.id)).not.toContain(inactive);
  expect((await listCategories(admin.db, { includeInactive: true })).find((c) => c.id === inactive)).toMatchObject({ isActive: false });
});

test('listDepartments returns active rows for a signed-in user and inactive ones on request', async () => {
  const { error } = await service.from('departments').insert([{ name: `dept-${tag}`, is_active: true }, { name: `off-${tag}`, is_active: false }]);
  if (error) throw error;
  const names = (await listDepartments(reporter.db)).map((d) => d.name);
  expect(names).toContain(`dept-${tag}`);
  expect(names).not.toContain(`off-${tag}`);
  expect((await listDepartments(reporter.db, { includeInactive: true })).map((d) => d.name)).toContain(`off-${tag}`);
});

test('listEquipment matches asset tag or name and hides retired equipment', async () => {
  expect((await listEquipment(reporter.db, { q: `${tag}-ac` })).map((e) => e.assetTag)).toEqual([`${tag}-AC-01`]);
  expect((await listEquipment(reporter.db, { q: tag })).map((e) => e.assetTag)).toEqual([`${tag}-AC-01`, `${tag}-PR-01`, `${tag}-PR-02`]);
  expect((await listEquipment(reporter.db, { q: `${tag}-OLD`, includeInactive: true })).map((e) => e.status)).toEqual(['retired']);
});

test('listEquipment returns the install location', async () => {
  expect(await listEquipment(reporter.db, { q: `${tag}-ac` })).toEqual([
    {
      id: expect.any(Number),
      assetTag: `${tag}-AC-01`,
      name: 'แอร์ ห้อง 101',
      serialNo: null,
      departmentId: null,
      installLocation: 'ตึก A ห้อง 101',
      status: 'active',
    },
  ]);
  expect((await listEquipment(reporter.db, { q: `${tag}-PR-01` }))[0]?.installLocation).toBeNull();
});

test('listEquipment treats , % _ ( ) " and * in the search text literally', async () => {
  expect((await listEquipment(reporter.db, { q: `50%, ชั้น (2) ${tag}` })).map((e) => e.assetTag)).toEqual([`${tag}-PR-01`]);
  expect((await listEquipment(reporter.db, { q: `50% ${tag}` })).map((e) => e.assetTag)).toEqual([]);
  expect((await listEquipment(reporter.db, { q: `ชั้น 2 ${tag}` })).map((e) => e.assetTag)).toEqual([`${tag}-PR-02`]);
  expect((await listEquipment(reporter.db, { q: `50_ ชั้น 2 ${tag}` })).map((e) => e.assetTag)).toEqual([]);
  expect(await listEquipment(reporter.db, { q: `${tag}*` })).toEqual([]);
  expect(await listEquipment(reporter.db, { q: '"),id.gt.0,name.ilike.("' })).toEqual([]);
});

test('listEquipment returns at most 20 rows', async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ asset_tag: `${tag}-BULK-${i}`, name: 'bulk' }));
  const { error } = await service.from('equipment').insert(rows);
  if (error) throw error;
  expect(await listEquipment(admin.db, { q: `${tag}-BULK` })).toHaveLength(20);
});

test('listTechnicians lists technicians for staff and nothing for a reporter', async () => {
  expect((await listTechnicians(admin.db)).map((t) => t.id)).toContain(tech.id);
  expect(await listTechnicians(reporter.db)).toEqual([]);
});

test('getProfile returns the display name and role of a user the caller may see', async () => {
  expect(await getProfile(tech.db, tech.id)).toEqual({ id: tech.id, displayName: expect.stringMatching(/^technician-/), role: 'technician' });
  expect(await getProfile(reporter.db, tech.id)).toBeNull();
});

test('getAccount returns the caller own department and join date', async () => {
  const { data: dept, error } = await service.from('departments').insert({ name: `acct-${tag}` }).select('id').single();
  if (error) throw error;
  const { error: linkError } = await service.from('profiles').update({ department_id: dept.id }).eq('id', reporter.id);
  if (linkError) throw linkError;
  expect(await getAccount(reporter.db, reporter.id)).toEqual({
    id: reporter.id,
    displayName: expect.stringMatching(/^reporter-/),
    role: 'reporter',
    departmentName: `acct-${tag}`,
    createdAt: expect.any(String),
  });
  expect(await getAccount(tech.db, tech.id)).toMatchObject({ departmentName: null });
});

test('savePushToken writes and clears only the caller own token', async () => {
  const token = async (id: string) => (await service.from('profiles').select('expo_push_token').eq('id', id).single()).data?.expo_push_token;

  await savePushToken(reporter.db, reporter.id, 'ExponentPushToken[mine]');
  expect(await token(reporter.id)).toBe('ExponentPushToken[mine]');

  await savePushToken(reporter.db, tech.id, 'ExponentPushToken[stolen]');
  expect(await token(tech.id)).toBeNull();

  await savePushToken(reporter.db, reporter.id, null);
  expect(await token(reporter.id)).toBeNull();
});

test('savePushToken takes a phone over from the previous user, so their notifications stop reaching it', async () => {
  const token = async (id: string) => (await service.from('profiles').select('expo_push_token').eq('id', id).single()).data?.expo_push_token;
  const phone = `ExponentPushToken[${crypto.randomUUID()}]`;

  await savePushToken(reporter.db, reporter.id, phone);
  await savePushToken(tech.db, tech.id, phone);

  expect(await token(tech.id)).toBe(phone);
  expect(await token(reporter.id)).toBeNull();
});
