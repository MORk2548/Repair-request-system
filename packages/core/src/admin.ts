import { z } from 'zod';
import { ROLES, type Role } from './status.ts';
import { requiredText } from './ticket.ts';

export const EQUIPMENT_STATUSES = ['active', 'under_repair', 'retired'] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

const departmentId = z.int().positive().nullable();
const displayName = requiredText('ชื่อ', 1, 100);
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label}ยาวได้ไม่เกิน ${max} ตัวอักษร`)
    .nullable()
    .transform((s) => s || null);

export const createUserSchema = z.object({
  email: z.string('กรุณากรอกอีเมล').trim().toLowerCase().pipe(z.email('กรุณากรอกอีเมลให้ถูกต้อง')),
  displayName,
  role: z.enum(ROLES, 'กรุณาเลือกบทบาท'),
  departmentId,
});
export type CreateUserInput = z.output<typeof createUserSchema>;

export const updateUserSchema = z.object({
  // guid, not uuid: Postgres takes any hex id, and the seed users' 5eed0000-… ids have no RFC version digit
  userId: z.guid(),
  displayName: displayName.optional(),
  role: z.enum(ROLES, 'กรุณาเลือกบทบาท').optional(),
  departmentId: departmentId.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.output<typeof updateUserSchema>;

// the body of a request to the admin-users Edge Function
export const adminUsersRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  createUserSchema.extend({ action: z.literal('create') }),
  updateUserSchema.extend({ action: z.literal('update') }),
]);
export type AdminUsersRequest = z.output<typeof adminUsersRequestSchema>;

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  departmentId: number | null;
  isActive: boolean;
};

export const departmentSchema = z.object({
  name: requiredText('ชื่อแผนก', 1, 100),
  isActive: z.boolean(),
});
export type DepartmentInput = z.output<typeof departmentSchema>;

export const categorySchema = z.object({
  name: requiredText('ชื่อหมวด', 1, 100),
  sortOrder: z.int('ลำดับต้องเป็นจำนวนเต็ม'),
  isActive: z.boolean(),
});
export type CategoryInput = z.output<typeof categorySchema>;

export const equipmentSchema = z.object({
  assetTag: requiredText('รหัสทรัพย์สิน', 1, 50),
  name: requiredText('ชื่ออุปกรณ์', 1, 100),
  model: optionalText('รุ่นเครื่อง', 100),
  serialNo: optionalText('หมายเลขเครื่อง', 100),
  monitorModel: optionalText('รุ่นจอ', 100),
  monitorSerialNo: optionalText('หมายเลขจอ', 100),
  userName: optionalText('ผู้ใช้งาน', 100),
  departmentId,
  installLocation: optionalText('สถานที่ติดตั้ง', 100),
  status: z.enum(EQUIPMENT_STATUSES),
});
export type EquipmentInput = z.output<typeof equipmentSchema>;

