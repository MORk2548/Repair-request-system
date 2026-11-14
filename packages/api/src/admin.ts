import {
  categorySchema,
  createUserSchema,
  departmentSchema,
  equipmentSchema,
  updateUserSchema,
  type AdminUser,
  type AdminUsersRequest,
  type CategoryInput,
  type CreateUserInput,
  type DepartmentInput,
  type EquipmentInput,
  type UpdateUserInput,
} from '@repair/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Db } from './client';
import { AdminError, DuplicateAssetTagError, throwDbError } from './errors';
import { toCategory, toDepartment, toEquipment, type Category, type Department, type Equipment } from './rows';

const FALLBACK = 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง';

async function invokeAdminUsers<T>(db: Db, body: AdminUsersRequest): Promise<T> {
  const { data, error } = await db.functions.invoke<T>('admin-users', { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const payload: unknown = await res.json().catch(() => null);
    const text = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : FALLBACK;
    throw new AdminError(text, res.status, { cause: error });
  }
  throw new AdminError(FALLBACK, 0, { cause: error });
}

export const adminListUsers = (db: Db): Promise<AdminUser[]> => invokeAdminUsers(db, { action: 'list' });

export const adminCreateUser = (db: Db, input: CreateUserInput): Promise<AdminUser> =>
  invokeAdminUsers(db, { action: 'create', ...createUserSchema.parse(input) });

export const adminUpdateUser = (db: Db, input: UpdateUserInput): Promise<Omit<AdminUser, 'email'>> =>
  invokeAdminUsers(db, { action: 'update', ...updateUserSchema.parse(input) });

type WithId<T> = T & { id?: number | undefined };

export async function saveDepartment(db: Db, { id, ...input }: WithId<DepartmentInput>): Promise<Department> {
  const v = departmentSchema.parse(input);
  const row = { name: v.name, is_active: v.isActive };
  const { data, error } = await (id === undefined
    ? db.from('departments').insert(row)
    : db.from('departments').update(row).eq('id', id)
  )
    .select()
    .single();
  if (error) throwDbError(error);
  return toDepartment(data);
}

export async function saveCategory(db: Db, { id, ...input }: WithId<CategoryInput>): Promise<Category> {
  const v = categorySchema.parse(input);
  const row = { name: v.name, sort_order: v.sortOrder, is_active: v.isActive };
  const { data, error } = await (id === undefined
    ? db.from('categories').insert(row)
    : db.from('categories').update(row).eq('id', id)
  )
    .select()
    .single();
  if (error) throwDbError(error);
  return toCategory(data);
}

export async function saveEquipment(db: Db, { id, ...input }: WithId<EquipmentInput>): Promise<Equipment> {
  const v = equipmentSchema.parse(input);
  const row = {
    asset_tag: v.assetTag,
    name: v.name,
    model: v.model,
    serial_no: v.serialNo,
    monitor_model: v.monitorModel,
    monitor_serial_no: v.monitorSerialNo,
    user_name: v.userName,
    department_id: v.departmentId,
    install_location: v.installLocation,
    status: v.status,
  };
  const { data, error } = await (id === undefined
    ? db.from('equipment').insert(row)
    : db.from('equipment').update(row).eq('id', id)
  )
    .select()
    .single();
  // 23505: the only unique column besides the id is asset_tag
  if (error?.code === '23505') throw new DuplicateAssetTagError(error.message, { cause: error });
  if (error) throwDbError(error);
  return toEquipment(data);
}
