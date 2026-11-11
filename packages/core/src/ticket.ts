import { z } from 'zod';
import type { TicketStatus } from './status';

export const PRIORITIES = ['low', 'normal', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

const text = (label: string, min: number, max: number) => {
  const required = `กรุณากรอก${label}`;
  return z
    .string(required)
    .trim()
    .superRefine((s, ctx) => {
      const n = [...s].length;
      if (n === 0) ctx.addIssue({ code: 'custom', message: required });
      else if (n < min) ctx.addIssue({ code: 'custom', message: `${label}ต้องมีอย่างน้อย ${min} ตัวอักษร` });
      else if (n > max) ctx.addIssue({ code: 'custom', message: `${label}ยาวได้ไม่เกิน ${max} ตัวอักษร` });
    });
};

const categoryRequired = 'กรุณาเลือกหมวดหมู่';

export const createTicketSchema = z.object({
  title: text('หัวข้อ', 3, 100),
  description: text('รายละเอียด', 1, 2000),
  location: text('สถานที่', 1, 100),
  categoryId: z.int(categoryRequired).positive(categoryRequired),
  priority: z.enum(PRIORITIES).default('normal'),
  equipmentId: z.int().positive().nullable().default(null),
  clientRequestId: z.uuid(),
});
export type CreateTicketInput = z.output<typeof createTicketSchema>;

export const resolutionSchema = text('วิธีแก้ไข', 1, 1000);

export const commentSchema = text('ความคิดเห็น', 1, 1000);

export type Ticket = {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  categoryId: number;
  equipmentId: number | null;
  priority: Priority;
  location: string;
  status: TicketStatus;
  reporterId: string;
  assigneeId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
