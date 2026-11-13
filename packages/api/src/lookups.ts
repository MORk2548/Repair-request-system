import type { Db } from './client';
import { throwDbError } from './errors';
import { quote } from './postgrest';
import {
  toCategory,
  toDepartment,
  toEquipment,
  toProfile,
  toTechnician,
  type Category,
  type Department,
  type Equipment,
  type Profile,
  type Technician,
} from './rows';

// every active user may read inactive lookups (old tickets show their names); pickers leave them out here
type ListOptions = { includeInactive?: boolean };

export async function listCategories(db: Db, { includeInactive = false }: ListOptions = {}): Promise<Category[]> {
  let query = db.from('categories').select().order('sort_order').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throwDbError(error);
  return data.map(toCategory);
}

export async function listDepartments(db: Db, { includeInactive = false }: ListOptions = {}): Promise<Department[]> {
  let query = db.from('departments').select().order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throwDbError(error);
  return data.map(toDepartment);
}

// PostgREST rewrites every * in an ilike pattern to %, so a literal * cannot be expressed there; an escaped regex can
const escapeRegex = (s: string) => s.replace(/[!-/:-@[-`{-~]/g, '\\$&');

// a search (the ticket form's picker) returns at most 20 matches; without q every row is listed
export async function listEquipment(db: Db, { q, includeInactive = false }: ListOptions & { q?: string }): Promise<Equipment[]> {
  let query = db.from('equipment').select().order('asset_tag');
  if (!includeInactive) query = query.neq('status', 'retired');
  const text = q?.trim();
  if (text) {
    const pattern = quote(escapeRegex(text));
    query = query.or(`asset_tag.imatch.${pattern},name.imatch.${pattern}`).limit(20);
  }
  const { data, error } = await query;
  if (error) throwDbError(error);
  return data.map(toEquipment);
}

export async function getProfile(db: Db, id: string): Promise<Profile | null> {
  const { data, error } = await db.from('profiles').select('id, display_name, role').eq('id', id).maybeSingle();
  if (error) throwDbError(error);
  return data && toProfile(data);
}

// RLS lets a user update only their own row, so another user's id changes nothing
// a token belongs to one phone; claiming it takes it away from whoever signed in there before
export async function savePushToken(db: Db, userId: string, token: string | null): Promise<void> {
  const { error } = token
    ? await db.rpc('claim_push_token', { p_token: token })
    : await db.from('profiles').update({ expo_push_token: null }).eq('id', userId);
  if (error) throwDbError(error);
}

export async function listTechnicians(db: Db): Promise<Technician[]> {
  const { data, error } = await db.from('technician_options').select().order('display_name');
  if (error) throwDbError(error);
  return data.map(toTechnician);
}
