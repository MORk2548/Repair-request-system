import { beforeAll, expect, test } from 'vitest';
import { getProfile, listCategories, listDepartments, listEquipment, listTechnicians } from '../src/index';
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

test('listCategories for a reporter hides inactive categories', async () => {
  const ids = (await listCategories(reporter.db)).map((c) => c.id);
  expect(ids).toContain(active);
  expect(ids).not.toContain(inactive);
  expect((await listCategories(admin.db)).map((c) => c.id)).toContain(inactive);
});

test('listDepartments returns rows for a signed-in user', async () => {
  const name = `dept-${tag}`;
  const { error } = await service.from('departments').insert({ name });
  if (error) throw error;
  expect((await listDepartments(reporter.db)).map((d) => d.name)).toContain(name);
});

test('listEquipment matches asset tag or name and hides retired equipment', async () => {
  expect((await listEquipment(reporter.db, { q: `${tag}-ac` })).map((e) => e.assetTag)).toEqual([`${tag}-AC-01`]);
  expect((await listEquipment(reporter.db, { q: tag })).map((e) => e.assetTag)).toEqual([`${tag}-AC-01`, `${tag}-PR-01`, `${tag}-PR-02`]);
});

test('listEquipment returns the install location', async () => {
  expect(await listEquipment(reporter.db, { q: `${tag}-ac` })).toEqual([
    { id: expect.any(Number), assetTag: `${tag}-AC-01`, name: 'แอร์ ห้อง 101', installLocation: 'ตึก A ห้อง 101' },
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
