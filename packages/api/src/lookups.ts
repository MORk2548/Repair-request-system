import type { Db } from './client';
import { throwDbError } from './errors';
import { quote } from './postgrest';
import { toEquipment, toTechnician, type Category, type Department, type Equipment, type Technician } from './rows';

export async function listCategories(db: Db): Promise<Category[]> {
  const { data, error } = await db.from('categories').select('id, name').order('sort_order').order('name');
  if (error) throwDbError(error);
  return data;
}

export async function listDepartments(db: Db): Promise<Department[]> {
  const { data, error } = await db.from('departments').select('id, name').order('name');
  if (error) throwDbError(error);
  return data;
}

// PostgREST rewrites every * in an ilike pattern to %, so a literal * cannot be expressed there; an escaped regex can
const escapeRegex = (s: string) => s.replace(/[!-/:-@[-`{-~]/g, '\\$&');

export async function listEquipment(db: Db, { q }: { q?: string }): Promise<Equipment[]> {
  let query = db.from('equipment').select('id, asset_tag, name').order('asset_tag').limit(20);
  const text = q?.trim();
  if (text) {
    const pattern = quote(escapeRegex(text));
    query = query.or(`asset_tag.imatch.${pattern},name.imatch.${pattern}`);
  }
  const { data, error } = await query;
  if (error) throwDbError(error);
  return data.map(toEquipment);
}

export async function listTechnicians(db: Db): Promise<Technician[]> {
  const { data, error } = await db.from('technician_options').select().order('display_name');
  if (error) throwDbError(error);
  return data.map(toTechnician);
}
