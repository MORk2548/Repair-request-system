# ระบบแจ้งซ่อม (เว็บ + แอป) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ระบบให้ผู้ใช้แจ้งซ่อมพร้อมรูปถ่ายผ่านเว็บและแอปมือถือ ให้แอดมินมอบหมายช่าง และให้ช่างอัปเดตสถานะจนปิดงาน โดยทุกฝ่ายได้รับแจ้งเตือนเมื่อสถานะเปลี่ยน

**Architecture:** monorepo เดียว แยก `packages/core` (type, กฎสถานะ, validation) และ `packages/api` (ฟังก์ชันเรียก Supabase) ให้เว็บกับแอปใช้ร่วมกัน กฎสิทธิ์และการเปลี่ยนสถานะอยู่ในฐานข้อมูล (RLS + RPC) ที่เดียว ฝั่ง TypeScript อ่านกฎเดียวกันเพื่อแสดงปุ่ม ไม่ตัดสินสิทธิ์เอง

**Tech Stack:** TypeScript, pnpm workspaces, Supabase (Postgres, Auth, Storage, Edge Functions), Next.js 15 (App Router) + `@supabase/ssr`, Expo (Expo Router, expo-notifications, expo-image-picker), Resend (อีเมล), zod, Vitest, jest-expo + React Native Testing Library, pgTAP (`supabase test db`), Playwright

**Spec:** หัวข้อ "Assumptions" ด้านล่าง + ER `แจ้งซ่อมER.pdf` (9 ตาราง: แผนก, ผู้ใช้งาน, อุปกรณ์, หมวดหมู่, ใบแจ้งปัญหา, ประวัติการแจ้ง, ความคิดเห็น, ไฟล์แนบ) ตารางเทียบ ER ↔ Supabase อยู่ใน Task 3

**ข้อมูลอ้างอิง:** โปรเจกต์ PHP เดิม `Repair System/` (PHP 8.3 + MySQL) ใช้เป็นแหล่งข้อมูล seed เท่านั้น (`database/seed.sql`: แผนก 7, ผู้ใช้ 10 คน) ไม่ย้ายโค้ด

## Assumptions (ใช้เป็น spec)

- **บทบาท:** `reporter` (ผู้แจ้ง), `technician` (ช่าง), `admin` (ผู้ดูแล) หนึ่งบัญชีมีหนึ่งบทบาท (จาก PHP เดิม: `employee` → `reporter`, `it_staff` → `technician`, `admin` → `admin`)
- **ผู้ใช้อยู่ในองค์กรเดียว** (ไม่ทำ multi-tenant) ล็อกอินด้วยอีเมล + รหัสผ่าน; ผู้ใช้สังกัดหนึ่งแผนก
- **บัญชีผู้ใช้:** admin สร้างให้ด้วยการเชิญทางอีเมล (ผู้ใช้ตั้งรหัสผ่านเองจากลิงก์) ไม่มีหน้าสมัครเอง; admin ปิดใช้งานบัญชีได้ (`is_active`) แทนการลบ
- **ใบแจ้งซ่อม:** `title`, `description`, `category_id`, `priority`, `location` (ข้อความอิสระ เช่น "ตึก A ชั้น 3 ห้องประชุม 2"), `equipment_id` (ไม่บังคับ), รูปถ่ายได้ไม่เกิน 5 รูป; ตอนช่างกด "เสร็จงาน" ต้องกรอก `resolution` (วิธีแก้ไข) และระบบบันทึก `resolved_at`
- **หมวด:** ตาราง `categories` ที่ admin เพิ่ม/แก้/ปิดใช้งานได้ ค่าเริ่มต้น: ไฟฟ้า, ประปา, เครื่องปรับอากาศ, เฟอร์นิเจอร์, เครือข่าย, อื่น ๆ
- **แผนกและอุปกรณ์:** admin จัดการได้บนเว็บ; อุปกรณ์มีรหัสทรัพย์สิน ชื่อ หมายเลขเครื่อง แผนกที่ดูแล สถานที่ติดตั้ง สถานะ (`active`, `under_repair`, `retired`)
- **ความเร่งด่วน (`priority`):** `low`, `normal` (ค่าเริ่มต้น), `urgent`
- **สถานะ:** `new`, `assigned`, `in_progress`, `done`, `closed`, `cancelled`
- **แจ้งเตือนทางอีเมล:** ส่งให้ผู้รับกลุ่มเดียวกับ push (ตามกติกาใน Task 8) ไปยังอีเมลที่ใช้ล็อกอิน ผ่าน Resend; เป็นอีเมลแจ้งสถานะเท่านั้น ผู้รับตอบกลับไม่ได้
- **รับงานและส่งต่อ:** ช่างเห็นคิวใบ `new` ทั้งหมดและกด "รับงาน" ให้ตัวเองได้ ส่วน admin มอบหมายให้ช่างคนใดก็ได้; ช่างที่แก้ไม่ได้กด "ส่งต่อช่างคนอื่น" พร้อมเหตุผล (บังคับ) ใบกลับเป็น `assigned` ของช่างคนใหม่
- **รายงาน:** admin มีหน้าสรุปตัวเลขหน้าเดียว (จำนวนใบตามสถานะ/หมวด/ช่าง และเวลาเฉลี่ยจากแจ้งถึงแก้เสร็จ เลือกช่วงวันที่ได้)
- **ไม่ทำในแผนนี้ (YAGNI):** ทำงานออฟไลน์เต็มรูปแบบ, กราฟและการส่งออกรายงานเป็นไฟล์, SLA, ค่าใช้จ่ายและอะไหล่, LINE/SMS, การตั้งค่าเลือกรับ/ไม่รับอีเมลรายบุคคล, หลายภาษา (UI เป็นภาษาไทยอย่างเดียว)

## Flow การทำงาน (เทียบกับ flow chart)

| กล่องใน flow chart | ในระบบ | Task |
|---|---|---|
| กรอกชื่อผู้ใช้และรหัสผ่าน → ไม่ถูกต้อง → แสดงข้อความแจ้งเตือน | `/login` ด้วยอีเมล + รหัสผ่าน (Supabase Auth); ผิดแสดง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" และอยู่หน้าเดิม; Supabase จำกัดความถี่การลองให้เอง | 6, 10 |
| ตรวจสอบบทบาทผู้ใช้งาน | ผู้ใช้ทั่วไป = `reporter`, เจ้าหน้าที่ IT = `technician`, ผู้ดูแลระบบ = `admin`; หลังล็อกอินไป `/tickets` ซึ่งแสดงตามบทบาท | 6, 7 |
| สร้างใบแจ้ง → กรอกหัวข้อ/รายละเอียด → เลือกหมวดและความสำคัญ → บันทึก | `/tickets/new` (`TicketForm`) + เลือกอุปกรณ์และแนบรูปได้ | 6, 10 |
| ระบบสร้างเลขที่ใบแจ้ง | `generate_ticket_no` → `RQ-YYMM-NNNN` | 3 |
| รอเจ้าหน้าที่รับเรื่อง | สถานะ `new`; ช่างและ admin ได้แจ้งเตือน | 8 |
| เจ้าหน้าที่ตรวจสอบรายการแจ้งปัญหา | `/tickets` ของช่าง: แท็บ "คิวใบใหม่" (`new` ทั้งหมด) และ "งานของฉัน" | 7 |
| รับเรื่องและมอบหมายงาน | ช่างกด "รับงาน" (`new → assigned` ให้ตัวเอง) หรือ admin มอบหมาย | 4, 7 |
| ตรวจสอบและวิเคราะห์ปัญหา | ช่างกด "เริ่มงาน" (`assigned → in_progress`) | 4, 7 |
| แก้ไม่ได้ → บันทึกปัญหาและส่งต่อผู้เชี่ยวชาญ | "ส่งต่อช่างคนอื่น" (`reassign_ticket` + เหตุผล) → ช่างคนใหม่ได้ใบเป็น `assigned` | 4, 7 |
| ดำเนินการแก้ไข → บันทึกวิธีแก้ไข → เปลี่ยนสถานะเป็นแก้ไขเสร็จ | "เสร็จงาน" (`in_progress → done`) ต้องกรอก `resolution` | 4, 7 |
| แจ้งผลให้ผู้ใช้งานทราบ | push + อีเมลถึงผู้แจ้งเมื่อ `done` | 8, 9 |
| ผู้ใช้งานตรวจสอบผล → ได้รับการแก้ไขแล้วหรือไม่ | ผู้แจ้งกด "ปิดงาน" (`done → closed`) หรือ "ขอแก้ไขใหม่" (`done → in_progress`) | 4, 7 |
| ผู้ดูแลระบบ: จัดการบัญชีผู้ใช้ / หมวดหมู่และอุปกรณ์ | `/admin/users`, `/admin/lists`, `/admin/equipment` | 7.5 |
| ผู้ดูแลระบบ: ดูรายงานและสถิติ | `/admin/reports` | 7.6 |

ที่ระบบมีแต่ flow chart ไม่ได้วาด: ยกเลิกใบ (`cancelled`), ความคิดเห็นบนใบ, ชนเวอร์ชันเมื่อสองคนแก้พร้อมกัน, แอปมือถือ

## Global Constraints

- ข้อความบน UI ทุกจุดเป็นภาษาไทย; โค้ด ชื่อตัวแปร และ commit message เป็นภาษาอังกฤษ
- เวลาเก็บเป็น UTC (`timestamptz`) แสดงผลเป็นเวลา `Asia/Bangkok` ปี พ.ศ. รูปแบบ `dd/MM/yyyy HH:mm`
- เลขใบแจ้งซ่อมรูปแบบ `RQ-YYMM-NNNN` (YYMM ตามเดือนเวลา `Asia/Bangkok`, NNNN รันใหม่ทุกเดือน เริ่มที่ 0001)
- รูปถ่าย: ไม่เกิน 5 รูปต่อใบ, ไม่เกิน 5 MB ต่อรูป, MIME เฉพาะ `image/jpeg`, `image/png`, `image/webp`
- `title` 3–100 ตัวอักษร, `description` 1–2000 ตัวอักษร, `location` 1–100 ตัวอักษร (นับเป็น code point หลัง trim)
- Node ≥ 20, pnpm ≥ 9; Expo SDK ล่าสุดที่เสถียร ณ วันเริ่มงาน; Next.js 15
- ทุกตารางเปิด RLS; ห้ามใช้ service-role key ในโค้ดฝั่งเว็บ/แอป
- อีเมลส่งผ่าน Resend จาก Edge Function เท่านั้น; `RESEND_API_KEY`, `EMAIL_FROM`, `WEB_BASE_URL` เป็น secret ของ Supabase ห้าม commit
- หัวเรื่องอีเมลขึ้นต้น `[แจ้งซ่อม] `; เนื้อหามีเฉพาะเลขใบ หัวข้อ สถานะ และลิงก์ `{WEB_BASE_URL}/tickets/{id}` — ไม่ใส่คำอธิบาย รูป หรือความคิดเห็น
- ข้อความจากผู้ใช้ที่ใส่ในส่วน HTML ของอีเมลต้อง escape `& < > " '`

## Review Focus

1. **กดส่งซ้ำ / เน็ตหลุดแล้วส่งใหม่** — ต้องได้ใบเดียว ไม่ซ้ำ (Task 5)
2. **สองคนเปลี่ยนสถานะใบเดียวกันพร้อมกัน** — คนที่สองต้องถูกปฏิเสธและเห็นข้อความ "มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่" ไม่ใช่เขียนทับเงียบ ๆ (Task 4, 7)
3. **ผู้แจ้งเรียก API ตรงเพื่อดูใบของคนอื่น** — ต้องได้ 0 แถว ไม่ใช่ error ที่เผยว่ามีใบอยู่ (Task 3)
4. **สร้างใบสำเร็จแต่อัปโหลดรูปล้มกลางทาง** — ใบต้องยังอยู่ แสดงปุ่ม "ลองอัปโหลดรูปอีกครั้ง" และการลองใหม่ต้องไม่สร้างใบซ้ำ (Task 6, 10)
5. **ข้อความที่ผู้ใช้พิมพ์จริง** — ภาษาไทยที่มีสระ/วรรณยุกต์ซ้อน, อีโมจิ, เว้นวรรคล้วน, ยาวเกินกำหนด ต้องนับและตัดสินถูกต้อง (Task 2) และเมื่อหัวข้อมี `<`, `&`, `"` ถูกใส่ลงอีเมล HTML ต้องแสดงเป็นตัวอักษรธรรมดา ไม่ถูกตีความเป็นแท็ก (Task 9)

---

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.base.json
packages/core/src/{status.ts, actions.ts, display.ts, ticket.ts, notify.ts, email.ts, index.ts}   # กฎล้วน ไม่แตะเครือข่าย
packages/core/test/{status.test.ts, ticket.test.ts, notify.test.ts, email.test.ts, parity.test.ts}
packages/api/src/{client.ts, rows.ts, postgrest.ts, tickets.ts, photos.ts, comments.ts, lookups.ts, admin.ts, errors.ts, database.types.ts}
packages/api/test/*.test.ts                                      # รันกับ Supabase local
supabase/migrations/{0001_schema.sql, 0002_rls.sql, 0003_transition.sql, 0004_photo_owner_delete.sql, 0005_admin.sql, 0006_reports.sql}
supabase/tests/{ticket_no.sql, rls.sql, transition.sql, photo_delete.sql, reports.sql}
supabase/seed.sql                                                # ข้อมูล dev จากโปรเจกต์ PHP เดิม
supabase/functions/notify-ticket-event/{index.ts, process.ts, process.test.ts, email.ts}
supabase/functions/admin-users/{index.ts, handler.ts, handler.test.ts}
apps/web/app/login/page.tsx, apps/web/app/(app)/{layout.tsx, tickets, tickets/new, tickets/[id]}  # (app) = route group ของหน้าที่ต้องล็อกอิน
apps/web/app/(app)/admin/{users, lists, equipment, reports}/page.tsx
apps/web/components/{TicketForm.tsx, TicketTable.tsx, StatusActions.tsx, CommentList.tsx}
apps/mobile/app/{_layout.tsx, index.tsx, (auth)/login.tsx, (tabs)/_layout.tsx, (tabs)/tickets.tsx, tickets/new.tsx, tickets/[id].tsx}
apps/mobile/lib/{supabase.ts, encryptedStorage.ts, env.ts, crypto.ts, photos.ts, useTicketSubmit.ts, push.ts}
apps/mobile/test/*.test.tsx                                      # ไม่อยู่ใน app/ เพราะทุกไฟล์ใน app/ เป็น route
e2e/smoke.spec.ts
```

---

### Task 1: โครง monorepo และกฎสถานะ (`packages/core/src/status.ts`)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `packages/core/package.json`, `packages/core/src/status.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/status.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type Role = 'reporter' | 'technician' | 'admin'`
  - `type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'done' | 'closed' | 'cancelled'`
  - `const TRANSITIONS: ReadonlyArray<{ from: TicketStatus; to: TicketStatus; role: Role }>`
  - `canTransition(from: TicketStatus, to: TicketStatus, role: Role): boolean`
  - `nextStatuses(from: TicketStatus, role: Role): TicketStatus[]`
  - `canReassign(status: TicketStatus, role: Role): boolean` — `true` เมื่อ `status` เป็น `assigned` หรือ `in_progress` และ `role` เป็น `technician` หรือ `admin` (ส่งต่องานไม่ใช่การเปลี่ยนสถานะ จึงไม่อยู่ใน `TRANSITIONS`)

ตาราง `TRANSITIONS` (ค่าจริงที่ต้องใช้ — Task 4 seed ตารางเดียวกันลงฐานข้อมูล):

| from | to | role |
|---|---|---|
| new | assigned | admin, technician (รับงานให้ตัวเองเท่านั้น) |
| new | cancelled | reporter, admin |
| assigned | in_progress | technician, admin |
| assigned | cancelled | admin |
| in_progress | done | technician, admin |
| done | closed | reporter, admin |
| done | in_progress | reporter, admin (เปิดงานซ้ำ) |

ความเป็นเจ้าของ (reporter ต้องเป็นเจ้าของใบ, technician ต้องเป็นผู้ถูกมอบหมาย, technician รับงาน `new` ได้แค่ให้ตัวเอง) ตรวจที่ฐานข้อมูลใน Task 4 ไม่ตรวจที่นี่

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว** ใน `status.test.ts`:

```ts
test('admin assigns a new ticket', () => expect(canTransition('new', 'assigned', 'admin')).toBe(true));
test('reporter cannot assign', () => expect(canTransition('new', 'assigned', 'reporter')).toBe(false));
test('technician cannot close', () => expect(canTransition('done', 'closed', 'technician')).toBe(false));
test('closed and cancelled are terminal', () => {
  expect(nextStatuses('closed', 'admin')).toEqual([]);
  expect(nextStatuses('cancelled', 'admin')).toEqual([]);
});
test('reporter can reopen a done ticket', () => expect(nextStatuses('done', 'reporter')).toEqual(['closed', 'in_progress']));
test('technician can take a new ticket', () => expect(nextStatuses('new', 'technician')).toEqual(['assigned']));
test('only staff can reassign, and only while assigned or in progress', () => {
  expect(canReassign('in_progress', 'technician')).toBe(true);
  expect(canReassign('in_progress', 'reporter')).toBe(false);
  expect(canReassign('done', 'admin')).toBe(false);
});
```

- [x] **Step 2: ตั้งค่า workspace (pnpm, TypeScript strict, Vitest) แล้วรัน** `pnpm --filter @repair/core test` — คาดว่า FAIL เพราะ `canTransition` ยังไม่มี
- [x] **Step 3: เขียน `TRANSITIONS`, `canTransition`, `nextStatuses`** ใน `status.ts` ตามตารางข้างบน (`nextStatuses` คืนตามลำดับในตาราง)
- [x] **Step 4: รัน** `pnpm --filter @repair/core test` — คาดว่า PASS
- [x] **Step 5: Commit**

```bash
git add . && git commit -m "feat(core): monorepo scaffold and ticket status machine"
```

---

### Task 2: Validation ใบแจ้งซ่อม (`packages/core/src/ticket.ts`)

**Files:**
- Create: `packages/core/src/ticket.ts`
- Modify: `packages/core/src/index.ts` (export เพิ่ม)
- Test: `packages/core/test/ticket.test.ts`

**Interfaces:**
- Consumes: `TicketStatus` จาก Task 1
- Produces:
  - `const PRIORITIES = ['low','normal','urgent'] as const; type Priority`
  - `createTicketSchema` (zod) → `type CreateTicketInput = { title: string; description: string; categoryId: number; priority: Priority; location: string; equipmentId: number | null; clientRequestId: string }` (`categoryId` จำนวนเต็มบวก, `equipmentId` ไม่ส่ง = `null`)
  - `type Ticket = { id: string; ticketNo: string; title: string; description: string; categoryId: number; equipmentId: number | null; priority: Priority; location: string; status: TicketStatus; reporterId: string; assigneeId: string | null; resolution: string | null; resolvedAt: string | null; version: number; createdAt: string; updatedAt: string }`
  - `resolutionSchema` — 1–1000 code point หลัง trim, ข้อความผิดพลาด "กรุณากรอกวิธีแก้ไข"
  - หมวดไม่ใช่ค่าคงที่ใน core อีกต่อไป (อ่านจากตาราง `categories`)

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว** (ครอบ Review Focus ข้อ 5):

```ts
const base = { title: 'แอร์ไม่เย็น', description: 'ห้องประชุม 2 แอร์ไม่เย็นตั้งแต่เช้า', categoryId: 3, location: 'ตึก A ชั้น 3', clientRequestId: crypto.randomUUID() };
test('priority defaults to normal', () => expect(createTicketSchema.parse(base).priority).toBe('normal'));
test('whitespace-only title is rejected', () => expect(createTicketSchema.safeParse({ ...base, title: '   ' }).success).toBe(false));
test('title is trimmed', () => expect(createTicketSchema.parse({ ...base, title: '  แอร์เสีย  ' }).title).toBe('แอร์เสีย'));
test('description counts code points: 2000 ok, 2001 rejected', () => {
  expect(createTicketSchema.safeParse({ ...base, description: '😀'.repeat(2000) }).success).toBe(true);
  expect(createTicketSchema.safeParse({ ...base, description: '😀'.repeat(2001) }).success).toBe(false);
});
test('Thai text with stacked vowels/tone marks is accepted', () => expect(createTicketSchema.safeParse({ ...base, title: 'น้ำรั่วที่ฝ้าเพดาน' }).success).toBe(true));
test('clientRequestId must be a uuid', () => expect(createTicketSchema.safeParse({ ...base, clientRequestId: 'abc' }).success).toBe(false));
test('equipmentId defaults to null; categoryId must be a positive integer', () => {
  expect(createTicketSchema.parse(base).equipmentId).toBeNull();
  expect(createTicketSchema.safeParse({ ...base, categoryId: 0 }).success).toBe(false);
});
test('whitespace-only resolution is rejected', () => expect(resolutionSchema.safeParse('   ').success).toBe(false));
```

- [x] **Step 2: รัน** `pnpm --filter @repair/core test ticket` — คาดว่า FAIL
- [x] **Step 3: เขียน `createTicketSchema` และ type ข้างบน** ใน `ticket.ts` — trim ก่อนนับ, นับความยาวด้วย `[...s].length`, ข้อความผิดพลาดเป็นภาษาไทย (เช่น "กรุณากรอกหัวข้อ")
- [x] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS
- [x] **Step 5: Commit** `git commit -m "feat(core): ticket schema and types"`

---

### Task 3: ฐานข้อมูล, เลขใบ, RLS (`supabase/migrations/0001_schema.sql`, `0002_rls.sql`)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`
- Test: `supabase/tests/ticket_no.sql`, `supabase/tests/rls.sql`

**Interfaces:**
- Consumes: ชื่อสถานะ/ความเร่งด่วนจาก Task 1–2 (สร้างเป็น enum ชื่อเดียวกัน)
- Produces (เทียบ ER):

| ER | ตาราง Supabase |
|---|---|
| แผนก | `departments(id int identity, name, is_active default true)` |
| ผู้ใช้งาน | `auth.users` (อีเมล, รหัสผ่าน) + `profiles(id uuid → auth.users, department_id, display_name, role, is_active default true, expo_push_token, created_at)` |
| หมวดหมู่ | `categories(id int identity, name, sort_order, is_active default true)` |
| อุปกรณ์ | `equipment(id int identity, asset_tag unique, name, serial_no, department_id, install_location, status equipment_status default 'active')` |
| ใบแจ้งปัญหา | `tickets(id uuid, ticket_no unique, client_request_id unique, title, description, category_id, equipment_id null, priority, location, status default 'new', reporter_id, assignee_id, resolution, resolved_at, version int default 1, created_at, updated_at)` |
| ประวัติการแจ้ง | `ticket_events(id, ticket_id, actor_id, action, from_status, to_status, detail, created_at)` — `action`: `created`, `status`, `assigned`, `reassigned`, `comment` |
| ความคิดเห็น | `ticket_comments(id, ticket_id, author_id, body, created_at)` |
| ไฟล์แนบ | `ticket_attachments(id, ticket_id, uploader_id, file_name, storage_path, created_at)` |

  - PK ของ ER เป็น int; `tickets` และ `profiles` ใช้ uuid (ลิงก์ `/tickets/{id}`, path รูป และ `auth.users.id`) ส่วนตาราง lookup ใช้ int ตาม ER
  - `current_app_role()` (security definer) คืนบทบาทของ `auth.uid()` เฉพาะเมื่อ `is_active` ไม่งั้นคืน `null` — ทุก policy ใช้ฟังก์ชันนี้ บัญชีที่ปิดใช้งานจึงเห็น 0 แถว
  - `generate_ticket_no(at timestamptz) returns text` (trigger `before insert` บน `tickets` เรียกด้วย `now()`)
  - bucket `ticket-photos` (private), path `{ticket_id}/{uuid}.{ext}`
  - นโยบาย RLS: reporter เห็น/สร้างเฉพาะใบของตน; technician เห็นใบที่ `assignee_id = auth.uid()` และใบ `status = 'new'` ทุกใบ (คิวรอรับงาน); admin เห็นทั้งหมด; view `technician_options(id, display_name)` ให้ technician/admin อ่านรายชื่อช่างที่ active (ใช้ตอนมอบหมาย/ส่งต่อ); ความคิดเห็นและรูปเห็นได้ตามสิทธิ์ของใบแม่
  - `departments`, `categories`, `equipment`: ผู้ล็อกอินอ่านได้ (ผู้ที่ไม่ใช่ admin เห็นเฉพาะ `is_active` / ไม่ `retired`), เขียนได้เฉพาะ admin
  - `profiles`: อ่านแถวตัวเองได้, admin อ่านทั้งหมด; ชื่อของคนอื่นบนใบอ่านผ่าน view `ticket_people(id, display_name)` ตามสิทธิ์ของใบ; ผู้ใช้แก้ได้แค่ `expo_push_token` ของตัวเอง
  - trigger `enforce_photo_limit` (เกิน 5 รูปต่อใบ → exception `photo_limit`)

- [x] **Step 1: เขียนเทสต์ pgTAP ที่ล้มเหลว**
  - `ticket_no.sql`: `generate_ticket_no('2026-11-30T17:30:00Z')` = `'RQ-2612-0001'` (เวลาไทยข้ามเป็น 1 ธ.ค. แล้ว); เรียกซ้ำเดือนเดียวกัน = `'RQ-2612-0002'`; `'2026-11-30T16:59:00Z'` = `'RQ-2611-0001'`
  - `rls.sql` (ครอบ Review Focus ข้อ 3): ผู้ใช้ A เลือกใบของ B → `is_empty`; technician เห็นเฉพาะใบที่ถูกมอบหมาย; admin เห็นครบ; insert `client_request_id` ซ้ำ → `throws_ok '23505'`; insert รูปที่ 6 → `throws_ok 'photo_limit'`; reporter `update tickets set status = 'closed'` ตรง ๆ → `throws_ok '42501'` (ไม่มีสิทธิ์ update เลย) และ admin ยังเห็นสถานะเป็น `new`; technician เห็นใบ `new` ของทุกคน แต่ไม่เห็นใบที่มอบหมายให้ช่างคนอื่นแล้ว; reporter select `technician_options` → `is_empty`; reporter insert `categories` → ถูกปฏิเสธ; บัญชีที่ `is_active = false` select `tickets` → `is_empty`; ใบที่อ้าง `equipment_id` ที่ไม่มีจริง → `throws_ok '23503'`
- [x] **Step 2: รัน** `supabase test db` — คาดว่า FAIL
- [x] **Step 3: เขียน migration สองไฟล์** ตาม Interfaces; `generate_ticket_no` ใช้ตาราง `ticket_counters(ym text primary key, last int)` กับ `insert … on conflict do update … returning` เพื่อกันเลขซ้ำเมื่อสร้างพร้อมกัน; ไม่ให้ role `authenticated` มีสิทธิ์ `update` ตรงบน `tickets.status/assignee_id/version` (ต้องผ่าน RPC ใน Task 4)
- [x] **Step 4: รัน** `supabase test db` — คาดว่า PASS
- [x] **Step 5: Commit** `git commit -m "feat(db): schema, ticket numbering and RLS"`

---

### Task 4: RPC เปลี่ยนสถานะ (`supabase/migrations/0003_transition.sql`)

**Files:**
- Create: `supabase/migrations/0003_transition.sql`
- Test: `supabase/tests/transition.sql`, `packages/core/test/parity.db.test.ts`

**Interfaces:**
- Consumes: ตารางจาก Task 3, `TRANSITIONS` จาก Task 1
- Produces:
  - ตาราง `status_transitions(from_status, to_status, role)` seed ค่าเดียวกับ `TRANSITIONS` ทุกแถว
  - `transition_ticket(p_ticket_id uuid, p_to ticket_status, p_expected_version int, p_assignee uuid default null, p_resolution text default null) returns tickets`
  - exception code: `version_conflict`, `forbidden_transition`, `assignee_required` (เมื่อ `new → assigned` ไม่ส่ง `p_assignee` หรือผู้ใช้นั้นไม่ใช่ `technician` ที่ active), `resolution_required` (เมื่อ `in_progress → done` ไม่ส่ง `p_resolution` หรือเป็นช่องว่างล้วน)
  - `→ done`: ตั้ง `resolution` และ `resolved_at = now()`; `done → in_progress` (เปิดซ้ำ): ล้าง `resolved_at` และเก็บ `resolution` เดิมไว้ใน `ticket_events.detail`
  - ถ้าใบมี `equipment_id`: `→ in_progress` ตั้ง `equipment.status = 'under_repair'`, `→ done` ตั้งกลับเป็น `'active'` ใน transaction เดียวกัน
  - technician เรียก `new → assigned` ได้เฉพาะเมื่อ `p_assignee = auth.uid()` ไม่งั้น `forbidden_transition`
  - ทุกครั้งที่สำเร็จ: `version = version + 1`, แทรกแถวใน `ticket_events` (`action = 'status'` หรือ `'assigned'`)
  - `reassign_ticket(p_ticket_id uuid, p_expected_version int, p_assignee uuid, p_reason text) returns tickets` (security definer): ผู้เรียกต้องเป็นช่างผู้ถูกมอบหมายของใบหรือ admin, ใบต้องอยู่ `assigned`/`in_progress`, ผู้รับต้องเป็น technician ที่ active และไม่ใช่คนเดิม; ตั้ง `assignee_id`, `status = 'assigned'`, `version + 1`, แทรก `ticket_events(action = 'reassigned', to_status = 'assigned', detail = p_reason)`; exception: `version_conflict`, `forbidden_transition`, `assignee_required`, `reason_required` (เหตุผลว่าง)

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - `transition.sql`: admin `new → assigned` พร้อม technician สำเร็จ และ `version` เป็น 2; เรียกซ้ำด้วย `p_expected_version = 1` → `throws_ok 'version_conflict'` (Review Focus ข้อ 2); reporter เรียก `new → assigned` → `'forbidden_transition'`; reporter เรียก `done → closed` บนใบของคนอื่น → `'forbidden_transition'`; technician ที่ไม่ใช่ผู้ถูกมอบหมายเรียก `assigned → in_progress` → `'forbidden_transition'`; `new → assigned` ไม่ส่ง assignee → `'assignee_required'`; `in_progress → done` ไม่ส่ง resolution → `'resolution_required'`; หลัง `done` ค่า `resolved_at` ไม่เป็น null และเปิดซ้ำแล้วเป็น null; อุปกรณ์ของใบเป็น `under_repair` ระหว่าง `in_progress`; technician รับใบ `new` ให้ตัวเองสำเร็จ แต่รับให้ช่างคนอื่น → `'forbidden_transition'`; `reassign_ticket` โดยช่างผู้ถูกมอบหมายสำเร็จและ `assignee_id` เป็นคนใหม่, ไม่มีเหตุผล → `'reason_required'`, ช่างที่ไม่ใช่ผู้ถูกมอบหมาย → `'forbidden_transition'`, บนใบ `done` → `'forbidden_transition'`
  - `parity.db.test.ts`: อ่านตาราง `status_transitions` จาก Supabase local แล้วยืนยันว่าทุก `(from, to, role)` ตรงกับ `TRANSITIONS` เป๊ะ (ไม่ขาดไม่เกิน)
- [x] **Step 2: รัน** `corepack pnpm test:db` (= `supabase test db` แล้ว `corepack pnpm --filter @repair/core test:db`) — คาดว่า FAIL
- [x] **Step 3: เขียน `transition_ticket`** เป็น `security definer`, ล็อกใบด้วย `select … for update` แล้วเทียบ `version` กับ `p_expected_version` (ไม่ตรง → `version_conflict`), ตรวจสิทธิ์จาก `status_transitions` + ความเป็นเจ้าของ
- [x] **Step 4: รัน** `corepack pnpm test:db` **ซ้ำ** — คาดว่า PASS
- [x] **Step 5: Commit** `git commit -m "feat(db): transition_ticket rpc with optimistic locking"`

---

### Task 5: แพ็กเกจ API (`packages/api`)

**Files:**
- Create: `packages/api/src/{client.ts, rows.ts, postgrest.ts, tickets.ts, photos.ts, comments.ts, lookups.ts, errors.ts, index.ts}`, `packages/api/src/database.types.ts` (gen ด้วย `corepack pnpm gen:types`), `supabase/migrations/0004_photo_owner_delete.sql` (ให้ผู้อัปโหลดลบไฟล์ของตัวเองที่ยังไม่ผูกกับ `ticket_attachments` ได้ เพื่อเก็บกวาดเมื่อ insert ล้มเหลว)
- Modify: `packages/core/src/ticket.ts` (เพิ่ม `commentSchema`)
- Test: `packages/api/test/{tickets,photos,comments,lookups}.test.ts`, `packages/api/test/helpers.ts`, `supabase/tests/photo_delete.sql`, `packages/core/test/ticket.test.ts`

**Interfaces:**
- Consumes: `CreateTicketInput`, `Ticket`, `TicketStatus` (core); RPC/ตารางจาก Task 3–4
- Produces:
  - `type Db = SupabaseClient<Database>`
  - `createTicket(db: Db, input: CreateTicketInput): Promise<Ticket>` — idempotent ตาม `clientRequestId`
  - `listTickets(db: Db, f: { status?: TicketStatus; limit?: number; cursor?: string }): Promise<{ items: Ticket[]; nextCursor: string | null }>` (เรียงใหม่สุดก่อน, `limit` ค่าเริ่มต้น 20)
  - `getTicket(db: Db, id: string): Promise<TicketDetail | null>` โดย `TicketDetail = Ticket & { photos: { id: number; url: string }[]; comments: Comment[]; events: TicketEvent[] }` (url เป็น signed URL อายุ 1 ชั่วโมง; คืน `null` เมื่อไม่มีใบนั้นหรือมองไม่เห็น เพราะ RLS ทำให้สองกรณีเหมือนกัน; comments/events เรียงเก่าสุดก่อน)
  - `transitionTicket(db: Db, a: { ticketId: string; to: TicketStatus; expectedVersion: number; assigneeId?: string; resolution?: string }): Promise<Ticket>`
  - `addComment(db: Db, ticketId: string, body: string): Promise<Comment>` (ตรวจด้วย `commentSchema` ของ core: 1–1000 ตัวอักษรหลัง trim)
  - `attachPhoto(db: Db, ticketId: string, file: { data: Blob | ArrayBuffer; mime: string; size: number; name: string }): Promise<{ id: number }>` (เขียน `ticket_attachments` พร้อม `uploader_id` และ `file_name`; ถ้า insert ล้มเหลวหลังอัปโหลด จะลบไฟล์ที่อัปโหลดทิ้งก่อนโยน error)
  - `reassignTicket(db: Db, a: { ticketId: string; expectedVersion: number; assigneeId: string; reason: string }): Promise<Ticket>`
  - `lookups.ts`: `listCategories(db)`, `listDepartments(db)`, `listEquipment(db, { q?: string })` (ค้น `asset_tag`/`name` แบบไม่สนตัวพิมพ์ด้วย `imatch` ที่ escape regex แล้ว เพราะ PostgREST แปลง `*` ใน `ilike` เป็น `%` เสมอ จึงค้น `*` ตามตัวอักษรไม่ได้; ไม่เกิน 20 แถว), `listTechnicians(db)` (จาก `technician_options`)
  - error class: `VersionConflictError`, `ForbiddenTransitionError`, `AssigneeRequiredError`, `ResolutionRequiredError`, `ReasonRequiredError`, `PhotoLimitError`, `PhotoInvalidError` (`reason: 'mime' | 'size'`) แปลงจากข้อความ exception ผ่านตารางเดียวใน `errors.ts`; ข้อมูลผิดรูปแบบ (`createTicketSchema`, `resolutionSchema`, `commentSchema`) โยน `ZodError` ที่มีข้อความไทย

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว** (รันกับ Supabase local ด้วยผู้ใช้ทดสอบสามบทบาท):

```ts
test('createTicket twice with same clientRequestId returns the same ticket', async () => {
  const a = await createTicket(reporterDb, input);
  const b = await createTicket(reporterDb, input);
  expect(b.id).toBe(a.id);
  expect((await listTickets(reporterDb, {})).items).toHaveLength(1);
});
test('stale expectedVersion throws VersionConflictError', async () => {
  await transitionTicket(adminDb, { ticketId, to: 'assigned', expectedVersion: 1, assigneeId: techId });
  await expect(transitionTicket(adminDb, { ticketId, to: 'cancelled', expectedVersion: 1 })).rejects.toBeInstanceOf(VersionConflictError);
});
test('6th photo throws PhotoLimitError', /* attach 5 then 6th */);
test('6 MB or image/gif photo throws PhotoInvalidError before any upload', /* … */);
test('whitespace-only comment is rejected', /* … */);
test('listCategories for a reporter hides inactive categories', /* … */);
```

เพิ่มเติม: error ของ transition แต่ละแบบได้ class ที่ถูก, reporter เปิดใบของ reporter อื่นได้ `null`, signed URL โหลดได้จริง (200), แบ่งหน้าครบทุกแถวไม่ซ้ำ, ค้นอุปกรณ์ด้วย `,` `%` `_` `*` แล้วตรงตามตัวอักษร, reporter แนบรูปในใบของคนอื่นไม่ได้, อัปโหลดที่ insert ล้มเหลว (สองคำขอพร้อมกันตอนมี 4 รูป) ไม่เหลือไฟล์ค้าง, และ pgTAP `photo_delete.sql` สำหรับ policy ลบไฟล์

- [x] **Step 2: รัน** `corepack pnpm --filter @repair/api test:db` — คาดว่า FAIL (แพ็กเกจนี้ไม่มีสคริปต์ `test` เพราะทุกเทสต์ต้องใช้ DB; `corepack pnpm test:db` ที่ root รันให้ด้วย)
- [x] **Step 3: เขียนฟังก์ชันตาม Interfaces** — `createTicket` ใช้ `upsert(..., { onConflict: 'client_request_id', ignoreDuplicates: true })` แล้ว select กลับด้วย `client_request_id`; `attachPhoto` ตรวจ mime/ขนาดฝั่ง client ก่อนเรียกเครือข่าย นับรูปเดิมก่อนอัปโหลด และทุกฟังก์ชันแปลง exception ผ่าน `throwDbError`
- [x] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS (`corepack pnpm test:db`, `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm exec supabase db lint --level warning`)
- [x] **Step 5: Commit** `git commit -m "feat(api): ticket, photo and comment functions"`

---

### Task 6: เว็บ — ล็อกอิน, แจ้งซ่อม, รายการใบของฉัน

**Files:**
- Create: `apps/web/app/{layout.tsx, globals.css}`, `apps/web/app/login/page.tsx`, `apps/web/app/tickets/{layout.tsx, page.tsx}`, `apps/web/app/tickets/new/page.tsx`, `apps/web/components/{TicketForm.tsx, TicketTable.tsx, LoginForm.tsx, SignOutButton.tsx}`, `apps/web/lib/{env.ts, supabase-server.ts, supabase-browser.ts}`, `apps/web/middleware.ts`, `apps/web/.env.example`, `packages/core/src/display.ts`, `supabase/seed.sql`
- Modify: `packages/api/src/lookups.ts` (`listEquipment` คืน `installLocation`, เพิ่ม `getProfile` สำหรับชื่อบน header), `packages/core/src/ticket.ts` (ค่าคงที่รูป `MAX_PHOTOS`, `MAX_PHOTO_BYTES`, `PHOTO_MIME_TYPES` ที่ api ใช้ร่วม)
- Test: `apps/web/components/{TicketForm.test.tsx, LoginForm.test.tsx}`, `packages/core/test/display.test.ts`, `packages/api/test/lookups.test.ts`

- [x] **Step 0: seed ข้อมูล dev** `supabase/seed.sql` (โหลดโดย `supabase db reset` เท่านั้น; ย้ายมาจาก Task 12) คัดจาก `Repair System/database/seed.sql`:
  - `departments`: 7 แผนก (ใช้ `name_th`)
  - ผู้ใช้ 10 คน (อีเมล `@helpdesk.test` ชุดเดิม): insert `auth.users` + `auth.identities` ด้วย `crypt('helpdesk-dev', gen_salt('bf'))` และ uuid คงที่ `5eed0000-0000-0000-0000-0000000000NN` (ไม่ใช้ `00000000-…` เพราะ pgTAP ใช้ช่วงนั้นอยู่) แล้ว insert `profiles` ด้วยชื่อ บทบาทที่แมปแล้ว (admin 1, technician 3, reporter 6) และแผนก; รหัสผ่าน dev เขียนไว้หัว `seed.sql` และ `AGENTS.md`
  - `categories`: ไฟฟ้า, ประปา, เครื่องปรับอากาศ, เฟอร์นิเจอร์, เครือข่าย (sort 1–5), อื่น ๆ (99); `equipment`: ตัวอย่าง 6 รายการกระจายแผนก
  - ไม่ระบุ id ของ identity column เอง เพื่อให้แถวที่เทสต์ insert ทีหลังไม่ชน
  - ไม่นำ `branches`, `notifications`, `login_attempts`, การตั้งค่าธีม/ภาษา หรือใบงานจาก `tests/fixtures.sql` มา

**Interfaces:**
- Consumes: `createTicket`, `attachPhoto`, `listTickets`, `createTicketSchema`
- Produces:
  - `<TicketForm categories={Category[]} />` (หน้า server ส่งฟังก์ชันให้ client component ไม่ได้ ฟอร์มจึงไป `/tickets` เองเมื่อสำเร็จครบ แทน `onSubmitted`)
  - `<TicketTable items={Ticket[]} />`
  - `STATUS_LABELS`, `PRIORITY_LABELS`, `formatThaiDateTime(iso)` ใน `@repair/core` (มือถือใช้ร่วม)
  - เส้นทาง `/login`, `/tickets`, `/tickets/new` (ผู้ไม่ล็อกอินถูก redirect ไป `/login` ผ่าน middleware; `/` และ `/login` ของคนที่ล็อกอินแล้วไป `/tickets`)

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว** ด้วย Testing Library โดย mock `@repair/api` (เพิ่มจากสามข้อด้านล่าง: เลือกอุปกรณ์แล้วเติมสถานที่, รูปที่ 6 ถูกปฏิเสธด้วย "แนบรูปได้ไม่เกิน 5 รูป", `createTicket` ล้มแล้วข้อความที่พิมพ์ยังอยู่และส่งใหม่ใช้ `clientRequestId` เดิม, login ผิดแสดง "อีเมลหรือรหัสผ่านไม่ถูกต้อง"):

```tsx
test('shows Thai validation message for empty title and does not call createTicket', /* กดส่งว่าง ๆ → เห็น "กรุณากรอกหัวข้อ" */);
test('double click on submit calls createTicket once and reuses the same clientRequestId on retry', /* … */);
test('photo upload failure keeps the ticket and shows retry button', async () => {
  // createTicket resolves, attachPhoto rejects
  // expect: ข้อความ "สร้างใบแจ้งซ่อมแล้ว แต่อัปโหลดรูปไม่สำเร็จ" + ปุ่ม "ลองอัปโหลดรูปอีกครั้ง"
  // คลิกปุ่ม → attachPhoto ถูกเรียกอีก, createTicket ไม่ถูกเรียกซ้ำ
});
```

- [x] **Step 2: รัน** `pnpm --filter web test` — คาดว่า FAIL
- [x] **Step 3: เขียน `TicketForm`** — หมวดเป็น dropdown จาก `listCategories`; ช่องอุปกรณ์ (ไม่บังคับ) ค้นด้วยรหัสทรัพย์สิน/ชื่อผ่าน `listEquipment` เลือกแล้วเติม `location` จาก `install_location` ให้ (แก้ต่อได้); สร้าง `clientRequestId` ครั้งเดียวต่อฟอร์ม (`useRef`), ปิดปุ่มระหว่างส่ง, อัปโหลดรูปหลัง `createTicket` สำเร็จแล้วเท่านั้น, เก็บรูปที่ยังอัปโหลดไม่สำเร็จไว้ใน state ให้ลองใหม่ได้; เขียนหน้า login (อีเมล+รหัสผ่าน; ผิดแสดง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ไม่บอกว่าผิดช่องไหน), `/tickets`, `/tickets/new`
- [x] **Step 4: รัน** `pnpm --filter web test` — คาดว่า PASS; แล้ว `pnpm --filter web build` และเปิด dev server ตรวจจริงว่า `/login` แสดงผลและ `/tickets` ของคนไม่ล็อกอินถูกส่งไป `/login`
- [x] **Step 5: Commit** `git commit -m "feat(web): login, create ticket and my tickets"`

---

### Task 7: เว็บ — รายละเอียดใบ, แดชบอร์ดแอดมิน/ช่าง, เปลี่ยนสถานะ

**Files:**
- Create: `packages/core/src/actions.ts`, `apps/web/app/(app)/tickets/[id]/{page.tsx, not-found.tsx}`, `apps/web/components/{StatusActions.tsx, CommentList.tsx}`, `apps/web/lib/session.ts`
- Modify: ย้าย `apps/web/app/tickets/` ไปไว้ใต้ route group `apps/web/app/(app)/` และย้าย header จาก `tickets/layout.tsx` เป็น `(app)/layout.tsx` ให้หน้า `/admin` ของ Task 7.5 ใช้ร่วม (URL ไม่เปลี่ยน); `apps/web/app/(app)/tickets/page.tsx` (admin เห็นทุกใบพร้อมตัวกรองสถานะ `?status=`, technician มีแท็บ "งานของฉัน" (ค่าเริ่มต้น) และ "คิวใบใหม่" `?tab=queue`; ตัวกรองอยู่ในหน้า ไม่ใช่ใน `TicketTable`); `packages/core/src/display.ts` (`EVENT_LABELS`, `eventLabel`); `packages/api/src/tickets.ts` (`listTickets` กรอง `assigneeId`; `getTicket` คืน `categoryName`, `equipment`, `people` (ชื่อจาก view `ticket_people`) และคืน `null` เมื่อ id ไม่ใช่ uuid)
- Test: `packages/core/test/{actions.test.ts, display.test.ts}`, `apps/web/components/{StatusActions.test.tsx, CommentList.test.tsx}`, `packages/api/test/tickets.test.ts`

**Interfaces:**
- Consumes: `getTicket`, `listTickets`, `listTechnicians`, `transitionTicket`, `reassignTicket`, `addComment`, `nextStatuses`, `canReassign`, `resolutionSchema`, `commentSchema`, `VersionConflictError`, `ForbiddenTransitionError`
- Produces:
  - `ticketActions(ticket: Pick<Ticket, 'status' | 'reporterId' | 'assigneeId'>, user: { id; role }): TicketAction[]` ใน `@repair/core` (มือถือ Task 11 ใช้ร่วม) — เริ่มจาก `nextStatuses(status, role)` แล้วใช้กฎเจ้าของเดียวกับฐานข้อมูล: reporter ต้องเป็นผู้แจ้ง; technician ต้องเป็นผู้ถูกมอบหมาย ยกเว้นใบ `new` ที่ได้ "รับงาน"; admin ได้ทุกปุ่มและได้ "มอบหมายช่าง" (`needs: 'assignee'`); เพิ่ม "ส่งต่อช่างคนอื่น" เมื่อ `canReassign` และเป็น admin หรือผู้ถูกมอบหมาย; ป้ายปุ่มอยู่ในตารางเดียวตาม `${from}>${to}` ("เสร็จงาน" มี `needs: 'resolution'`) ฐานข้อมูลยังเป็นผู้ตัดสิน ฟังก์ชันนี้แค่ซ่อนปุ่มที่จะถูกปฏิเสธ
  - `<StatusActions ticket={Ticket} user={{ id: string; role: Role }} technicians={Technician[]} />` — แสดงปุ่มจาก `ticketActions`; แผงเป็น state machine `idle | assign | done | reassign | cancel | conflict` + `pending` + ข้อความ error; ส่ง `expectedVersion = ticket.version` ทุกครั้ง; ปุ่มทั้งหมดปิดระหว่างรอผล; "มอบหมายช่าง" เปิดตัวเลือกช่าง; "รับงาน" ส่ง `assigneeId` = ตัวเอง; "ส่งต่อช่างคนอื่น" เปิดตัวเลือกช่าง (ไม่รวมคนปัจจุบัน) + ช่องเหตุผลบังคับ ("กรุณากรอกเหตุผล"); "ยกเลิกใบแจ้ง" ถามยืนยันในหน้า (ไม่ใช้ `window.confirm`); สำเร็จแล้ว `router.refresh()` (หน้า server ส่ง `onChanged` ให้ client component ไม่ได้ เหตุผลเดียวกับ `TicketForm`) ยกเว้นช่างที่ส่งต่องานซึ่งมองไม่เห็นใบนั้นแล้ว จึงไป `/tickets`; หน้า detail ใส่ `key={ticket.version}` ให้แผงเริ่มใหม่เมื่อข้อมูลใหม่มาถึง
  - `<CommentList ticketId comments people />` — เรียงเก่าไปใหม่ พร้อมชื่อผู้เขียนและวันที่ไทย; ฟอร์มตรวจด้วย `commentSchema` ส่งสำเร็จแล้วล้างช่องและ `router.refresh()`

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว** (นอกจากห้าข้อด้านล่าง: "รับงาน" ส่ง `assigneeId` ของตัวเองและ `expectedVersion`, "ยกเลิกใบแจ้ง" ต้องผ่านขั้นยืนยัน, ปุ่มปิดระหว่างรอผล, `ForbiddenTransitionError` แสดง "คุณไม่มีสิทธิ์ทำรายการนี้", error อื่นแสดง "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง", ช่างที่ส่งต่องานกลับไป `/tickets`; `actions.test.ts` สำหรับ `ticketActions`; `CommentList.test.tsx`: ความคิดเห็นว่างแสดงข้อความไทยและไม่เรียก `addComment`, ส่งสำเร็จแล้วช่องว่าง):

```tsx
test('reporter on a done ticket sees only "ปิดงาน" and "ขอแก้ไขใหม่"', /* … */);
test('closed ticket renders no action buttons', /* … */);
test('technician on a new ticket sees "รับงาน" and it assigns to themself', /* … */);
test('"ส่งต่อช่างคนอื่น" requires a reason and excludes the current technician from the list', /* … */);
test('VersionConflictError shows "มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่" and a reload button, ticket state unchanged', /* … */);
```

- [x] **Step 2: รัน** `pnpm --filter web test StatusActions` — คาดว่า FAIL
- [x] **Step 3: เขียน `StatusActions`, `CommentList` และหน้า detail** — ส่ง `expectedVersion = ticket.version` ทุกครั้ง; ตอนชน version แสดงข้อความพร้อมปุ่ม "โหลดใหม่" ที่เรียก `router.refresh()` ไม่ refetch เงียบ ๆ และใบที่แสดงไม่เปลี่ยนจนกว่าจะกด; ปุ่ม "เสร็จงาน" เปิดช่องกรอกวิธีแก้ไขก่อนส่ง (ตรวจด้วย `resolutionSchema`); หน้า detail (`getTicket` ได้ `null` → `notFound()` หน้า "ไม่พบใบแจ้งซ่อมนี้") แสดงเลขใบ หัวข้อ สถานะ ความเร่งด่วน หมวด อุปกรณ์ สถานที่ รายละเอียด ผู้แจ้ง ช่าง วันที่แจ้ง/อัปเดต วิธีแก้ไขและวันที่แก้ไขเสร็จ รูป (signed URL กดเปิดขนาดเต็ม) ประวัติพร้อมชื่อผู้ทำและรายละเอียด (เหตุผลส่งต่อ, วิธีแก้ไข) และความคิดเห็น
- [x] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS (เพิ่มเคส: กด "เสร็จงาน" โดยไม่กรอกวิธีแก้ไข → เห็น "กรุณากรอกวิธีแก้ไข" และไม่เรียก `transitionTicket`)
- [x] **Step 5: Commit** `git commit -m "feat(web): ticket detail, status actions and staff dashboard"`

---

### Task 7.5: เว็บ — หน้า admin (ผู้ใช้, แผนก, หมวด, อุปกรณ์)

**Files:**
- Create: `supabase/migrations/0005_admin.sql`, `supabase/functions/admin-users/{index.ts, handler.ts, deno.json}`, `supabase/templates/invite.html`, `packages/core/src/admin.ts`, `packages/api/src/admin.ts`, `apps/web/app/auth/confirm/route.ts`, `apps/web/app/set-password/page.tsx`, `apps/web/app/(app)/admin/{users,lists,equipment}/page.tsx`, `apps/web/components/{Field,useAction,InviteUserForm,UserRow,LookupRow,EquipmentRow,SetPasswordForm}.tsx`, root `vitest.config.ts` และ `tsconfig.json`
- Modify: `apps/web/middleware.ts` (`/auth/confirm` เปิดให้ผู้ที่ยังไม่เข้าระบบ; ผู้ที่ไม่ใช่ admin เข้า `/admin/*` → redirect `/tickets`), `apps/web/app/(app)/layout.tsx` (ลิงก์ ผู้ใช้ / แผนกและหมวด / อุปกรณ์ เฉพาะ admin), `apps/web/app/login/page.tsx` (`?error=link`), `packages/api/src/lookups.ts`, `packages/core/src/display.ts`, `supabase/config.toml` (template คำเชิญ, `additional_redirect_urls`)
- Test: `supabase/functions/admin-users/handler.test.ts`, `supabase/tests/equipment_status.sql`, `supabase/tests/rls.sql`, `packages/api/test/{admin,lookups,tickets}.test.ts`, `packages/core/test/{admin,display}.test.ts`, `apps/web/components/admin.test.tsx`

**Interfaces:**
- Consumes: ตาราง `profiles`, `departments`, `categories`, `equipment` (Task 3)
- Produces:
  - `0005_admin.sql`: ผู้ใช้ที่ active ทุกคนอ่านแผนก หมวด อุปกรณ์ได้ทุกแถว (ใบเก่ายังแสดงชื่อที่ปิดใช้งานแล้ว) ส่วน picker ซ่อนเองใน `@repair/api`; `sync_equipment_status(p_equipment_id)` (client เรียกไม่ได้) ตั้งอุปกรณ์เป็น `under_repair` เมื่อมีใบ `in_progress` อยู่ ไม่งั้น `active` และไม่แตะ `retired`; `transition_ticket` และ `reassign_ticket` เรียกหลังเปลี่ยนสถานะทุกครั้ง
  - Edge Function `admin-users` (service-role จาก env ของ function เท่านั้น; `verify_jwt` เปิด): body เป็น zod discriminated union ใน core `admin.ts`: `list` → profiles พร้อมอีเมล; `create { email, displayName, role, departmentId }` → `inviteUserByEmail` (redirect `${WEB_BASE_URL}/auth/confirm`) แล้ว upsert `profiles` (ถ้าเขียน profile ไม่ได้ ลบ Auth user ทิ้ง); `update { userId, displayName?, role?, departmentId?, isActive? }` → `isActive` สั่ง `ban_duration` `876000h` / `none` ด้วย
  - กฎใน `handler.ts` (ไม่ import ของ Deno; deps `{ getCaller, listUsers, listProfiles, inviteUser, upsertProfile, updateProfile, setBan, deleteUser }`): ไม่มี token → 401; ไม่ใช่ admin ที่ active → 403 ก่อนเรียก dep อื่น; body ผิด → 400 ข้อความไทยจาก zod; อีเมลที่มีใน Auth แล้ว (ตรวจก่อนเชิญ เพราะ Auth ส่งคำเชิญซ้ำให้อีเมลที่ยังไม่ยืนยันแทนที่จะ error) → 409 "อีเมลนี้มีผู้ใช้แล้ว"; ปิดบัญชีหรือเปลี่ยนบทบาทตัวเอง → 400 "ไม่สามารถปิดบัญชีหรือเปลี่ยนบทบาทของตัวเองได้"
  - รับคำเชิญ: อีเมล (`templates/invite.html`) ลิงก์ไป `/auth/confirm?token_hash=…&type=invite` → `verifyOtp` → `/set-password` (อย่างน้อย 8 ตัว ยืนยันตรงกัน) → `/tickets`; ลิงก์เสีย → `/login?error=link` "ลิงก์ไม่ถูกต้องหรือหมดอายุ"
  - `packages/api/src/admin.ts`: `adminListUsers`, `adminCreateUser`, `adminUpdateUser` เรียก Edge Function (ข้อผิดพลาด → `AdminError` พร้อมข้อความไทย); `saveDepartment`, `saveCategory`, `saveEquipment` เขียนตรงผ่าน RLS (admin เท่านั้น; รหัสทรัพย์สินซ้ำ → `DuplicateAssetTagError`); `listCategories` / `listDepartments` / `listEquipment` ซ่อนรายการที่ปิด/ปลดระวาง เว้นแต่ส่ง `{ includeInactive: true }`
  - `/admin/users`: ตาราง ชื่อ อีเมล บทบาท แผนก สถานะ, ฟอร์มเชิญ, แก้ชื่อ/บทบาท/แผนกรายแถว, ปิดใช้งาน/เปิดใช้งานพร้อมยืนยันในหน้า (แถวของตัวเองไม่มีปุ่มปิดและไม่มีช่องบทบาท); `/admin/lists`: แผนกและหมวด เพิ่ม/เปลี่ยนชื่อ/ลำดับ (หมวด)/ปิด-เปิด ไม่ลบ; `/admin/equipment`: ตาราง + ฟอร์มเพิ่ม/แก้ (รหัสทรัพย์สินซ้ำ → "รหัสทรัพย์สินนี้มีอยู่แล้ว")

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
test('non-admin caller gets 403 and no Auth API is called', /* … */);
test('inactive admin caller gets 403', /* … */);
test('admin cannot deactivate their own account (400)', /* … */);
test('duplicate email returns Thai error "อีเมลนี้มีผู้ใช้แล้ว"', /* … */);
test('deactivating a user also bans them in Auth', /* … */);
```

พร้อม pgTAP `equipment_status.sql` (in_progress → ส่งต่อ → active; ยกเลิกหลังส่งต่อยัง active; สองใบบนอุปกรณ์เดียว ปิดใบหนึ่งยัง under_repair; retired คงเดิม) และเทสต์เว็บ (ฟอร์มเชิญตรวจข้อมูลและแสดง 409, แถวตัวเองไม่มีปุ่มปิด, ปิดใช้งานต้องยืนยัน, ปิดหมวดเรียก save ด้วย `isActive: false`, รหัสทรัพย์สินซ้ำ)

- [x] **Step 2: รัน** `corepack pnpm test` และ `corepack pnpm test:db` — คาดว่า FAIL
- [x] **Step 3: เขียน migration, handler, index.ts, admin.ts, หน้ารับคำเชิญ และหน้า admin ทั้งสาม**
- [x] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS (`test:db` ต้องให้ function ถูก serve อยู่ ซึ่ง `db:start` ทำให้เอง) และพิสูจน์คำเชิญจริง: เชิญจากหน้า `/admin/users` อ่านอีเมลที่ http://127.0.0.1:54324 เปิดลิงก์ ตั้งรหัสผ่าน แล้วเข้าระบบด้วยรหัสนั้น
- [x] **Step 5: Commit** `fix(db): lookup visibility and derived equipment status` แล้ว `feat(web): admin pages for users, lists and equipment`

---

### Task 7.6: เว็บ — หน้าสรุปรายงานของ admin

**Files:**
- Create: `supabase/migrations/0006_reports.sql`, `apps/web/app/(app)/admin/reports/page.tsx`, `packages/api/src/reports.ts`, `packages/core/src/dates.ts`
- Modify: `packages/api/src/errors.ts` (`forbidden`, `invalid_range`), `apps/web/app/(app)/layout.tsx` (ลิงก์ "รายงาน")
- Test: `supabase/tests/reports.sql`

**Interfaces:**
- Consumes: `tickets`, `categories`, `profiles` (Task 3)
- Produces:
  - `ticket_summary(p_from date, p_to date) returns jsonb` (security definer; ผู้เรียกที่ไม่ใช่ admin active → exception `forbidden`, `p_from > p_to` → `invalid_range`): นับใบที่ `created_at` อยู่ในช่วง (ตามวันเวลา `Asia/Bangkok`, รวมทั้งสองวัน) แยกตามสถานะ (ครบทั้ง 6 สถานะแม้เป็น 0) หมวด และช่าง (ใบที่ยังไม่มอบหมายเป็นแถว `assignee_id: null`) และ `avg_resolve_hours` = ค่าเฉลี่ย `resolved_at - created_at` ของใบที่มี `resolved_at`
  - `getTicketSummary(db, { from: string; to: string })` ใน `reports.ts`
  - `/admin/reports`: เลือกช่วงวันที่ (ค่าเริ่มต้น = เดือนปัจจุบัน) แล้วแสดงตารางตัวเลข ไม่มีกราฟ (ฟอร์ม GET ธรรมดา ช่วงวันที่ไม่ถูกต้องแสดงข้อความภาษาไทยแล้วกลับไปใช้เดือนปัจจุบัน; `bangkokMonthRange` และ `dateRangeSchema` อยู่ใน `packages/core/src/dates.ts`)

- [x] **Step 1: เขียนเทสต์ pgTAP ที่ล้มเหลว** ใน `reports.sql`: seed 3 ใบในช่วงและ 1 ใบนอกช่วง → นับได้ 3; ใบที่สร้าง `2026-11-30T17:30:00Z` นับเป็นวันที่ 1 ธ.ค.; ใบ `done` 2 ใบใช้เวลา 2 และ 4 ชั่วโมง → `avg_resolve_hours = 3`; reporter เรียก → `throws_ok 'forbidden'`
- [x] **Step 2: รัน** `supabase test db` — คาดว่า FAIL
- [x] **Step 3: เขียน `ticket_summary`, `getTicketSummary` และหน้า `/admin/reports`**
- [x] **Step 4: รันซ้ำ** — คาดว่า PASS
- [x] **Step 5: Commit** `git commit -m "feat: admin ticket summary report"`

---

### Task 8: แจ้งเตือน (Edge Function + กฎผู้รับ)

**Files:**
- Create: `packages/core/src/notify.ts`, `supabase/functions/notify-ticket-event/{index.ts, process.ts, deno.json}`, `supabase/migrations/0007_notify.sql`
- Modify: `packages/core/src/index.ts`, `supabase/config.toml` (`verify_jwt = false` ของฟังก์ชันนี้), `supabase/seed.sql` (Vault secrets ของเครื่อง dev), `supabase/functions/.env.example`, `tsconfig.json`
- Test: `packages/core/test/notify.test.ts`, `supabase/functions/notify-ticket-event/process.test.ts` (Vitest ที่ root ครอบ `supabase/functions/**/*.test.ts`), `supabase/tests/notify.sql`

**Interfaces:**
- Consumes: ตาราง `ticket_events`, `profiles.expo_push_token`
- Produces:
  - `recipientsFor(e: { toStatus: TicketStatus; actorId: string | null }, t: { reporterId: string; assigneeId: string | null }, staff: { adminIds: string[]; technicianIds: string[] }): string[]` — ไม่มีรายการซ้ำ และไม่รวม `actorId` (ส่งต่องานใช้ event `to_status = 'assigned'` จึงแจ้งช่างคนใหม่ + ผู้แจ้งด้วยกติกาเดียวกัน); กติกาเป็นตาราง `RECIPIENTS` หนึ่งแถวต่อสถานะ
  - `messageFor(toStatus: TicketStatus, ticketNo: string): { title: string; body: string }` (ภาษาไทย, ตาราง `MESSAGES`)
  - `ticketEventPayloadSchema` (zod) — body ที่ trigger ส่งมา `{ id, ticket_id, actor_id, action, to_status }`
  - `type Deps = { loadTicket(id: string): Promise<{ id; ticketNo } | null>; listStaffIds(): Promise<{ adminIds: string[]; technicianIds: string[] }>; getContact(userId: string): Promise<{ pushToken: string | null } | null>; sendPush(token: string, m: { title: string; body: string; ticketId: string }): Promise<void> }` — `listStaffIds` เฉพาะบัญชี active, `getContact` คืน `null` เมื่อไม่มีโปรไฟล์หรือปิดบัญชี
  - `processEvent(e: { id: string; ticketId: string; actorId: string | null; toStatus: TicketStatus; reporterId: string; assigneeId: string | null } (ผู้แจ้งและช่างของใบ ณ ตอนเกิดเหตุการณ์ ซึ่ง trigger อ่านใน transaction เดียวกันแล้วส่งมาใน payload; ผู้รับคิดจากค่านี้ ไม่อ่านจากใบภายหลัง), deps: Deps): Promise<{ sent: number; failed: number; skipped: number }>` และ `handle({ secret, body }, expectedSecret, deps)` ใน `process.ts` — ไม่ import อะไรเฉพาะ Deno เพื่อให้ Vitest รันได้
  - `index.ts` (Deno) ต่อ deps จริงด้วย service-role key และส่ง Expo push ไป `EXPO_PUSH_URL` (ค่าเริ่มต้น `https://exp.host/--/api/v2/push/send`); ตอบ 200 เสมอเมื่อประมวลผลจบ
  - trigger `notify_ticket_event` (after insert on `ticket_events` ที่มี `to_status`) ส่ง event ด้วย `pg_net` ไป URL ใน Vault secret `notify_function_url` พร้อม header `x-webhook-secret` = Vault secret `notify_webhook_secret`; ไม่มี secret ก็ไม่ส่ง และ error ใด ๆ เป็นแค่ warning เพื่อไม่ให้การเปลี่ยนใบ rollback

กติกาผู้รับ (เฉพาะบัญชีที่ `is_active`): `new` → ผู้ดูแลและช่างทุกคน (คิวรอรับงาน); `assigned` → ช่างที่ได้รับมอบหมาย + ผู้แจ้ง; `in_progress` → ผู้แจ้ง + ช่างที่ได้รับมอบหมาย (เพื่อให้การเปิดงานซ้ำ `done → in_progress` ของผู้แจ้งถึงช่าง; ผู้ทำรายการถูกตัดออกเสมอ); `done` → ผู้แจ้ง + ผู้ดูแล; `closed`, `cancelled` → ช่างที่เกี่ยวข้อง + ผู้ดูแล

ฟังก์ชันปิด `verify_jwt` เพราะผู้เรียกคือฐานข้อมูล ไม่ใช่ผู้ใช้ จึงตรวจ header `x-webhook-secret` เทียบกับ env `NOTIFY_WEBHOOK_SECRET` แทน (ไม่ตรง/ไม่มี → 401, body ผิด → 400, event ที่ไม่มีสถานะ → 200 โดยไม่ทำอะไร)

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
test('new ticket notifies all admins and technicians except the actor', () =>
  expect(recipientsFor({ toStatus: 'new', actorId: 'a1' }, { reporterId: 'r1', assigneeId: null }, { adminIds: ['a1', 'a2'], technicianIds: ['t1'] }).sort()).toEqual(['a2', 't1']));
test('assigned notifies technician and reporter', () =>
  expect(recipientsFor({ toStatus: 'assigned', actorId: 'a1' }, { reporterId: 'r1', assigneeId: 't1' }, { adminIds: ['a1'], technicianIds: ['t1', 't2'] }).sort()).toEqual(['r1', 't1']));
test('technician taking a ticket themself notifies only the reporter', /* actor t1 = assignee → ['r1'] */);
test('reassign by the old technician notifies the new assignee and the reporter', /* … */);
test('a reporter reopening a done ticket notifies the assignee', /* … */);
test('no duplicates when reporter is also admin', /* … */);
test('actor never notified of own action', /* … */);
test('every status has a Thai message that names the ticket', /* … */);
// process.test.ts
test('processEvent pushes to every recipient that has a token and skips those without', /* … */);
test('a push failure for one recipient does not stop the others', /* … */);
test('a missing or wrong webhook secret gets 401 and processes nothing', /* … */);
// supabase/tests/notify.sql: ไม่มี secret ก็สร้างใบได้และไม่มีคิว; มี secret แล้วสร้างใบ/transition เพิ่มคิวใน net.http_request_queue ทีละแถว; URL เสียไม่ทำให้สร้างใบล้ม; client เรียกฟังก์ชัน trigger ไม่ได้
```

- [x] **Step 2: รัน** `corepack pnpm --filter @repair/core test notify`, `corepack pnpm exec vitest run process` และ `corepack pnpm exec supabase test db` — คาดว่า FAIL
- [x] **Step 3: เขียน `recipientsFor`, `messageFor`, `processEvent`, `index.ts` และ `0007_notify.sql`** (`index.ts` ใช้ service-role key จาก secret ของ Supabase เท่านั้น; ถ้า push ของผู้รับคนใดล้มเหลวให้ log แล้วไปคนถัดไป ไม่ throw)
- [x] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS; แล้วลองบน local stack: ตั้ง `EXPO_PUSH_URL` ให้ชี้ HTTP listener บนเครื่อง, สร้างใบและให้ช่างรับงาน แล้วดูว่า push ถึงคนที่ถูกต้องและผู้ทำรายการไม่ได้รับ
- [x] **Step 5: Commit** `git commit -m "feat: ticket event notifications"`

---

### Task 9: อีเมลแจ้งเตือน

**Files:**
- Create: `packages/core/src/email.ts`, `supabase/functions/notify-ticket-event/email.ts`
- Modify: `packages/core/src/index.ts`, `supabase/functions/notify-ticket-event/process.ts` (ส่งอีเมลควบคู่ push), `supabase/functions/notify-ticket-event/index.ts` (ต่อ deps จริง), `supabase/functions/.env.example`
- Test: `packages/core/test/email.test.ts`, `supabase/functions/notify-ticket-event/email.test.ts`, `supabase/functions/notify-ticket-event/process.test.ts` (เพิ่มเคส)

**Interfaces:**
- Consumes: `recipientsFor`, `messageFor`, `processEvent`, `Deps` (Task 8); `TicketStatus`
- Produces:
  - `escapeHtml(s: string): string` — แทน `& < > " '` ด้วย entity
  - `buildEmail(toStatus: TicketStatus, t: { id: string; ticketNo: string; title: string }, baseUrl: string): { subject: string; text: string; html: string }` — `subject` = `[แจ้งซ่อม] ` + `messageFor(toStatus, t.ticketNo).title`; `text`/`html` มีข้อความจาก `messageFor(...).body`, หัวข้อใบ และลิงก์ `{baseUrl}/tickets/{id}` (ตัด `/` ท้าย `baseUrl` ทุกตัวก่อนต่อ, `id` ผ่าน `encodeURIComponent`) พร้อมเลขใบและป้ายสถานะภาษาไทย (`STATUS_LABELS`) และบรรทัดท้าย `อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ`; `text` ใช้หัวข้อดิบ, `html` (`lang="th"` ไม่มีตาราง) ใส่ทุกค่ารวมลิงก์ผ่าน `escapeHtml`
  - `Deps` ขยาย: `loadTicket` คืน `{ id; ticketNo; title } | null`, `getContact` คืน `{ pushToken: string | null; email: string | null } | null` และเพิ่ม `sendEmail(to: string, mail: { subject: string; text: string; html: string }, idempotencyKey: string): Promise<void>`, `webBaseUrl: string`, `emailEnabled: boolean` (ปิดอยู่ `sendEmail` ไม่ถูกเรียกและนับเป็น skipped)
  - `processEvent` คืนจำนวนแยกช่องทาง `{ push: { sent, failed, skipped }, email: { sent, failed, skipped } }` และ `handle` ตอบ 200 ด้วยค่านี้
  - `sendEmail` จริง (`email.ts` `sendViaResend(fetch, { apiUrl, apiKey, from }, to, mail, key)` รับ `fetch` และค่า env เป็นอาร์กิวเมนต์ เพื่อให้ Vitest ทดสอบได้): `POST ${RESEND_API_URL ?? 'https://api.resend.com/emails'}` พร้อม header `Authorization: Bearer ${RESEND_API_KEY}` และ `Idempotency-Key`, body `{ from: EMAIL_FROM, to: [to], subject, text, html }`; สถานะตอบกลับที่ไม่ใช่ 2xx → throw พร้อมสถานะและข้อความตอบกลับ; `index.ts` เปิดอีเมลเมื่อมีทั้ง `RESEND_API_KEY` และ `EMAIL_FROM` เท่านั้น (เครื่อง dev ปล่อยว่าง เพราะที่อยู่ `@helpdesk.test` ของ seed ไม่มีจริง), `WEB_BASE_URL` ค่าเริ่มต้น `http://localhost:3000`
  - คีย์กันส่งซ้ำ: `${event.id}:${userId}`; `getContact` จริงอ่านอีเมลจาก `supabase.auth.admin.getUserById`

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
// email.test.ts
const t = { id: 'abc', ticketNo: 'RQ-2611-0001', title: '<script>alert(1)</script> & "x"' };
test('subject starts with [แจ้งซ่อม] and contains the ticket number', () =>
  expect(buildEmail('assigned', t, 'https://x.test').subject).toMatch(/^\[แจ้งซ่อม\] .*RQ-2611-0001/));
test('html escapes the title but text keeps it raw', () => {
  const m = buildEmail('assigned', t, 'https://x.test');
  expect(m.html).not.toContain('<script>');
  expect(m.html).toContain('&lt;script&gt;');
  expect(m.text).toContain('<script>alert(1)</script>');
});
test('link is {baseUrl}/tickets/{id} with no double slash', () =>
  expect(buildEmail('done', t, 'https://x.test/').html).toContain('https://x.test/tickets/abc'));
test('email never includes description or comments', /* buildEmail รับเฉพาะ id/ticketNo/title — ยืนยันด้วย type */);
// process.test.ts
test('sends one email per recipient that has an address, with key `${event.id}:${userId}`', /* … */);
test('recipient without email still gets push; recipient without token still gets email', /* … */);
test('email failure does not block push and push failure does not block email', /* ใช้ Promise.allSettled */);
test('retrying the same event reuses the same idempotency keys', /* … */);
// เพิ่ม: escapeHtml ครบห้าตัวและไม่ escape `&` ซ้ำ; `"` ในหัวข้อหลุดออกจาก attribute ไม่ได้; ลิงก์ใน text มีครั้งเดียว; `/` ท้ายหลายตัวถูกตัด; มีป้ายสถานะ;
// emailEnabled false ไม่ส่งอีเมลและนับ skipped; อีเมลมีหัวข้อที่ escape และลิงก์; ผู้รับไม่มีโปรไฟล์/ปิดบัญชีไม่ได้ทั้งสองช่องทาง;
// supabase/functions/notify-ticket-event/email.test.ts: URL override, header, รูป body, 422 → throw
```

- [x] **Step 2: รัน** `corepack pnpm exec vitest run` และ `corepack pnpm --filter @repair/core test email` — คาดว่า FAIL
- [x] **Step 3: เขียน `escapeHtml`, `buildEmail`, ขยาย `processEvent` และ `sendEmail`** — ส่ง push กับอีเมลของผู้รับแต่ละคนด้วย `Promise.allSettled` และ log ความล้มเหลวโดยไม่ throw
- [x] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS; แล้วลองบน local stack: ตั้ง `RESEND_API_URL` ให้ชี้ HTTP listener บนเครื่อง, สร้างใบที่หัวข้อมี `<b>`, `&`, `"` และให้ช่างรับงาน แล้วดูว่าอีเมลถึงคนที่ถูกต้อง หัวข้อถูก escape และลิงก์ถูก; เอา `RESEND_API_KEY` ออกแล้วต้องไม่มีอีเมลออก
- [x] **Step 5: Commit** `git commit -m "feat: email notifications via Resend"`

---

### Task 10: แอป — ล็อกอิน, แจ้งซ่อมพร้อมถ่ายรูป, รายการใบ

**Files:**
- Create: `apps/mobile/index.ts` (โหลด `lib/crypto.ts` ก่อน `expo-router/entry`), `apps/mobile/app/{_layout.tsx, index.tsx, (auth)/login.tsx, (tabs)/_layout.tsx, (tabs)/tickets.tsx, tickets/new.tsx}`, `apps/mobile/lib/{supabase.ts, encryptedStorage.ts, env.ts, crypto.ts, photos.ts, useTicketSubmit.ts}`, `apps/mobile/components/ui.tsx`, `apps/mobile/.env.example`; root script `mobile:dev`
- Session: `expo-secure-store` เก็บค่าได้ราว 2 KB แต่ session ของ Supabase ใหญ่กว่า จึงเก็บกุญแจ AES-256 สุ่มไว้ใน SecureStore และเก็บ session ที่เข้ารหัส AES-GCM แล้วไว้ใน AsyncStorage (แบบเดียวกับคู่มือ Expo ของ Supabase แต่ใช้ AES ของ `expo-crypto` ไม่เพิ่มไลบรารี)
- Hermes ไม่มี `crypto.randomUUID` จึงเติมจาก `expo-crypto` ที่ entry ครั้งเดียว (`lib/crypto.ts`) ไม่แก้จุดเรียกใน `@repair/api`
- Test: `apps/mobile/test/{new, login, tickets, layout, crypto}.test.tsx` (ไม่วางใน `app/` เพราะ Expo Router นับทุกไฟล์ใน `app/` เป็น route) และ `packages/api/test/photos.test.ts` เพิ่มกรณี JPEG ที่ส่งเป็น `ArrayBuffer`

**Interfaces:**
- Consumes: `createTicket`, `attachPhoto`, `listTickets`, `listCategories`, `listEquipment`, `createTicketSchema`
- Produces: หน้าจอ `/login`, `/(tabs)/tickets` (ดึงลงเพื่อโหลดใหม่, ดึงเพิ่มเมื่อเลื่อนสุดด้วย `nextCursor`), `/tickets/new` (เลือกรูปจากกล้อง/คลัง สูงสุด 5 รูป ย่อเป็น JPEG ด้านยาว 1600 px คุณภาพ 0.7 ก่อนอัปโหลด); `useTicketSubmit` (สร้างใบ → อัปโหลดรูป → ลองใหม่เฉพาะรูปที่ล้ม) ให้ Task 11 ใช้ต่อได้โดยไม่ต้องแก้

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว** ด้วย jest-expo + RNTL (mock `@repair/api`, `expo-image-picker`, `expo-image-manipulator`, `lib/supabase`, `expo-router`):

```tsx
test('shows Thai validation errors and blocks submit when form is empty', /* … */);
test('selecting a 6th photo is refused with "แนบรูปได้ไม่เกิน 5 รูป"', /* … */);
test('photo failure keeps ticket, shows retry; retry does not call createTicket again', /* … */);
test('draft text survives a failed createTicket (network error) and can be resubmitted with same clientRequestId', /* … */);
// เพิ่ม: เลือกอุปกรณ์แล้วเติมสถานที่, ไม่ได้สิทธิ์กล้องแล้วแสดงข้อความไทย, ล็อกอินผิดแสดง "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
// รายการโหลดหน้าถัดไปเมื่อเลื่อนสุดและแสดง "ยังไม่มีใบแจ้งซ่อม", ไม่มีตัวแปร env แสดงข้อความไทย, ล็อกอิน/ออกแล้วสลับหน้าจอ, shim ของ crypto
```

- [x] **Step 2: รัน** `corepack pnpm --filter mobile test` — คาดว่า FAIL
- [x] **Step 3: เขียนหน้าจอทั้งสาม** — ใช้ตรรกะเดียวกับ `TicketForm` (หมวดจาก `listCategories`, เลือกอุปกรณ์ได้) (สร้าง `clientRequestId` ครั้งเดียวต่อฟอร์ม, อัปโหลดรูปหลังสร้างใบ); ย่อรูปก่อนอัปโหลดด้วย `expo-image-manipulator` ให้ไม่เกิน 5 MB
- [x] **Step 4: รัน** `corepack pnpm --filter mobile test` — คาดว่า PASS; แล้ว `expo export --platform android` และ `--platform ios` ต้อง bundle ได้ และ `corepack pnpm mobile:dev` ต้องเสิร์ฟ manifest ที่ IP Wi-Fi
- [x] **Step 5: Commit** `git commit -m "feat(mobile): login, create ticket with photos, ticket list"`

---

### Task 11: แอป — รายละเอียดใบ, ปุ่มเปลี่ยนสถานะ, push token

**Files:**
- Create: `apps/mobile/app/tickets/[id].tsx`, `apps/mobile/components/{StatusActions,CommentList}.tsx`, `apps/mobile/lib/{push,useProfile}.ts`
- Modify: `apps/mobile/app/_layout.tsx` (`ProfileProvider`, ลงทะเบียน push หลังล็อกอิน, แตะการแจ้งเตือน, `tickets/[id]` อยู่ใน guard), `apps/mobile/app/(tabs)/_layout.tsx` (ออกจากระบบล้าง token ก่อน), `apps/mobile/app/(tabs)/tickets.tsx` (รายการตามบทบาท), `apps/mobile/app.json` (plugin `expo-notifications`), `apps/mobile/.env.example` (`EXPO_PUBLIC_EAS_PROJECT_ID`), `packages/api/src/lookups.ts` (`savePushToken`)
- Test: `apps/mobile/test/{detail,push,tickets,layout}.test.tsx`, `packages/api/test/lookups.test.ts`

**Interfaces:**
- Consumes: `getProfile`, `getTicket`, `listTickets`, `listTechnicians`, `transitionTicket`, `reassignTicket`, `addComment`, `ticketActions`, `resolutionSchema`, `commentSchema`, `VersionConflictError`, `ForbiddenTransitionError`
- Produces:
  - `savePushToken(db: Db, userId: string, token: string | null): Promise<void>` ใน `@repair/api` — เขียน `profiles.expo_push_token` ของตัวเองเท่านั้น (RLS)
  - `registerPushToken(db: Db, userId: string): Promise<'registered' | 'denied' | 'unsupported'>` — `'unsupported'` เมื่อไม่ใช่เครื่องจริง, Expo Go บน Android (ไม่มี remote push ตั้งแต่ SDK 53) หรือไม่มี EAS project id (`extra.eas.projectId` ที่ `npx eas init` เขียน หรือ `EXPO_PUBLIC_EAS_PROJECT_ID`); Android สร้าง channel ก่อนขอสิทธิ์; ไม่ได้สิทธิ์ → `'denied'` ไม่เขียนอะไร; ไม่งั้นบันทึก Expo push token; root layout เรียกครั้งเดียวเมื่อมี session โดยไม่รอผล
  - `signOut(db, userId)` — ล้าง token ก่อน (เครื่องที่ใช้ร่วมกันจะไม่ได้แจ้งเตือนของคนก่อน) แล้วออกจากระบบแม้ล้างไม่สำเร็จ
  - `useNotificationTaps(signedIn)` — banner ตอนแอปเปิดอยู่; แตะแล้วเปิด `/tickets/${data.ticketId}` ทั้งตอนแอปเปิดอยู่และ cold start (รับเฉพาะ guid)
  - `useProfile()` → `{ userId, profile }` ใช้ร่วมกันระหว่างรายการและหน้ารายละเอียด
  - รายการตามบทบาทเหมือนเว็บ: ช่างมี "งานของฉัน" / "คิวใบใหม่", admin มีชิปสถานะ, เปิดใบด้วยการแตะแถว; หน้ารายละเอียดแสดงข้อมูลเท่าหน้าเว็บ หัวเรื่องเป็นเลขใบ แผงปุ่ม state machine เดียวกับ `StatusActions` ของเว็บ (ชนเวอร์ชัน → "มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่" + ปุ่ม "โหลดใหม่"; ช่างที่ส่งต่องานกลับไปรายการ)

- [x] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
test('registerPushToken returns "denied" and writes nothing when permission refused', /* … */);
test('registerPushToken returns "unsupported" on simulator/no device', /* … */);
test('registerPushToken saves token to profiles for the current user', /* … */);
// detail.test.tsx
test('technician assigned to ticket sees "เริ่มงาน" on assigned ticket', /* … */);
test('VersionConflictError shows reload message', /* … */);
// เพิ่ม: ช่างเห็นสองมุมมองและคิวโหลด status 'new', ชิปสถานะของ admin, ไม่พบใบ, ผู้แจ้งบนใบ done ของตัวเองเห็นแค่ ปิดงาน/ขอแก้ไขใหม่,
// เสร็จงานไม่กรอกวิธีแก้ไข, ส่งต่อไม่รวมช่างคนเดิมและต้องมีเหตุผล, ForbiddenTransitionError, ตรวจความคิดเห็น,
// 'unsupported' บน Expo Go Android และเมื่อไม่มี project id, ออกจากระบบล้าง token ก่อน, แตะการแจ้งเตือนที่ ticketId ไม่ใช่ guid ไม่เปิดอะไร, savePushToken เขียนแถวคนอื่นไม่ได้
```

- [x] **Step 2: รัน** `corepack pnpm --filter mobile test` — คาดว่า FAIL
- [x] **Step 3: เขียน `push.ts`, `useProfile.ts`, หน้ารายละเอียด และรายการตามบทบาท**
- [x] **Step 4: รัน** `corepack pnpm --filter mobile test` และ `corepack pnpm test:db` — คาดว่า PASS; `expo export` ทั้ง ios และ android ต้อง bundle ได้ และ `npx expo-doctor` ผ่าน; push ทดสอบบนเครื่องจริงได้หลังมีบัญชี Expo และ project id เท่านั้น (Task 12)
- [x] **Step 5: Commit** `git commit -m "feat(mobile): ticket detail, status actions and push registration"`

---

### Task 12: ปล่อยใช้งานและ smoke test

แบ่งเป็นสี่ task ย่อย ทำทีละข้อและ commit แยกกัน

**ทำบน Supabase project จริงแล้ว (นอก repo):**
- [x] push schema ด้วย `supabase db push`
- [x] deploy `admin-users` และ `notify-ticket-event` (`verify_jwt = false` ตาม `config.toml`)
- [x] ตั้ง secrets ของ Edge Function ด้วย `supabase secrets set` และ Vault secrets สองตัวของ trigger `notify_ticket_event` ผ่าน SQL editor: `select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify-ticket-event', 'notify_function_url');` และ `select vault.create_secret('<ค่าเดียวกับ NOTIFY_WEBHOOK_SECRET>', 'notify_webhook_secret');` (seed.sql ไม่ถูกโหลดใน production; ถ้าไม่ตั้ง trigger จะไม่ส่งอะไรเลย)
- [x] อีเมลของ Auth (คำเชิญ) ส่งผ่าน Gmail SMTP พร้อม template คำเชิญภาษาไทย
- [x] สร้าง admin คนแรก

---

### Task 12.1: smoke test ด้วย Playwright

**Files:**
- Create: `e2e/smoke.spec.ts`, `e2e/resend-mock.ts`, `playwright.config.ts`
- Modify: `package.json` (`@playwright/test`, สคริปต์ `test:e2e`), `apps/web/next.config.ts` (`distDir` จาก `NEXT_DIST_DIR` ให้ server ของเทสต์ไม่ใช้ `.next` ร่วมกับ dev server), `apps/web/tsconfig.json`, `tsconfig.json`, `.gitignore`, `AGENTS.md`

- [x] **Step 1: เขียน Playwright smoke** ผ่าน UI จริงด้วยบัญชี dev จาก `supabase/seed.sql`: reporter ล็อกอิน → สร้างใบแจ้งซ่อมพร้อมรูป เลือกอุปกรณ์จากช่องค้นแล้วเห็นสถานที่ถูกเติม → เห็นเลข `RQ-` ในรายการและอุปกรณ์ในหน้า detail; admin มอบหมายช่าง → ช่าง `ส่งต่อช่างคนอื่น` (ตัวเลือกไม่มีชื่อตัวเอง เหตุผลว่างถูกปฏิเสธ) → ช่างคนใหม่ `เริ่มงาน` → `เสร็จงาน` (วิธีแก้ไขว่างเห็น "กรุณากรอกวิธีแก้ไข") → reporter `ปิดงาน` แล้วใบอยู่สถานะปิดงานและไม่มีปุ่มเหลือ; admin ปิดบัญชีผู้ใช้หนึ่งคนแล้วผู้ใช้นั้นล็อกอินไม่ได้ จากนั้นเปิดคืนและล็อกอินได้; เซิร์ฟเวอร์จำลอง Resend (`globalSetup` พอร์ต 8799, `RESEND_API_URL` ชี้มา) ได้รับอีเมลถึงผู้แจ้งตอน `assigned` และ `done` (รันเมื่อ `E2E_EMAIL=1` เท่านั้น เพราะต้อง restart stack ด้วยค่าใน `supabase/functions/.env` ตาม AGENTS.md); หัวข้อใบมี run id ไม่ซ้ำ จึงไม่ต้องใช้ฐานข้อมูลว่าง; config ไม่ยอมรันถ้า `NEXT_PUBLIC_SUPABASE_URL` ไม่ใช่ local
- [x] **Step 2: รัน** `corepack pnpm test:e2e` กับ Supabase local — ฟีเจอร์ทำเสร็จหมดแล้วจึงผ่านตั้งแต่รอบแรก; ยืนยันว่าเทสต์จับความผิดได้โดยแก้ให้คาดสถานะสุดท้ายผิดแล้วเห็น FAIL จากนั้นแก้คืน; รันผ่านสองรอบติดกัน และหนึ่งรอบด้วย `E2E_EMAIL=1`
- [x] **Step 3: Commit** `git commit -m "test: e2e smoke test of the full ticket cycle"`

---

### Task 12.2: เว็บบน Vercel

**Files:**
- Create: `.env.example`, `README.md` (ขั้นตอนตั้งค่า Supabase/Vercel/EAS)

- [x] **Step 1: เพิ่ม `.env.example`, README;** seed (`supabase/seed.sql`) ย้ายไปทำใน Task 6 แล้วเพื่อให้ใช้เว็บได้ตั้งแต่ตอนนั้น; README อ้างรหัสผ่าน dev จากหัว `seed.sql`
- [x] **Step 2: deploy** ด้วย `vercel deploy --prod` พร้อม `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ของ project จริง; ตั้ง `WEB_BASE_URL` ของ Edge Function เป็น URL ของ Vercel และเพิ่ม `<url>/auth/confirm` ใน redirect URLs ของ Auth (2026-11-13: https://repair-request-system-ten.vercel.app, Root Directory `apps/web`, คีย์ `sb_publishable_`)
- [ ] **Step 3: ตรวจบนเว็บจริง** ล็อกอิน admin → เชิญผู้ใช้ → ลิงก์ในอีเมลพาไป `/set-password` บนโดเมน Vercel
- [x] **Step 4: Commit** `git commit -m "chore: deployment docs"`

---

### Task 12.3: แอปมือถือ build ด้วย EAS

- [ ] **Step 1:** สมัครบัญชี Expo แล้ว `npx eas init` ใน `apps/mobile` (เขียน `extra.eas.projectId` ลง `app.json`) — ไม่มี project id แอปจะข้ามการลงทะเบียน push; push บน Android ต้องอัปโหลด FCM credentials (ไฟล์ service account ของ Firebase) ด้วย `eas credentials` และ push บน iOS ต้องมี Apple Developer account ให้ EAS สร้าง APNs key
- [ ] **Step 2: build** ด้วย `eas build --profile preview` (internal distribution) ชี้ไปที่ project จริง
- [ ] **Step 3: ลองบนมือถือจริงหนึ่งเครื่อง:** สร้างใบ → admin มอบหมาย → ได้ push ภายใน 1 นาที
- [ ] **Step 4: Commit** `git commit -m "chore(mobile): EAS project and preview build"`

---

### Task 12.4: อีเมลแจ้งเตือนใน production

- [ ] **Step 1:** ยืนยันโดเมนผู้ส่งกับ Resend (SPF/DKIM) และตั้ง `RESEND_API_KEY`, `EMAIL_FROM` (ที่อยู่บนโดเมนนั้น) ด้วย `supabase secrets set`
- [ ] **Step 2: ตรวจจริง:** สร้างใบ → admin มอบหมาย → ผู้แจ้งได้อีเมลภายใน 1 นาที และอีเมลไม่เข้าสแปม; ลิงก์ในอีเมลเปิดใบบนโดเมน Vercel
- [ ] **Step 3: Commit** การเปลี่ยนแปลงเอกสาร (ถ้ามี)

---

## Self-Review

1. **Spec coverage:** แจ้งซ่อม+รูป (T5, 6, 10), มอบหมาย/อัปเดตสถานะ + วิธีแก้ไข (T4, 7, 11), สิทธิ์ตามบทบาทและบัญชีที่ปิดใช้งาน (T3, 4, 7.5), แผนก/หมวด/อุปกรณ์ตาม ER (T3, 5, 7.5), รับงานเอง/ส่งต่อช่างตาม flow chart (T1, 3, 4, 7), รายงานสรุป (T7.6), แจ้งเตือน push (T8, 11) และอีเมล (T9), เว็บ (T6–7.5), แอป (T10–11), seed จากโปรเจกต์เดิม + ปล่อยใช้งาน (T12) — ครบตาม Assumptions และ ER
2. **Step scan:** แต่ละ step ระบุไฟล์ ลายเซ็น หรือค่าที่ spec กำหนดครบ ไม่มีเนื้อฟังก์ชันที่ลายเซ็นกับเทสต์ตัดสินไปแล้ว
3. **Type consistency:** ใช้ `Ticket`, `CreateTicketInput`, `TicketStatus`, `Role`, `Db`, `transitionTicket`, `VersionConflictError` ชื่อเดียวกันทุก task; กฎสถานะมีที่มาเดียว (`TRANSITIONS` ↔ `status_transitions`) และมี parity test บังคับให้ตรงกัน
4. **Review Focus:** ทั้งห้าข้อมีเทสต์ใน task ที่ระบุไว้
5. **Proportion:** โค้ดในแผนเป็นเทสต์และลายเซ็นเท่านั้น ส่วนเนื้อฟังก์ชันให้ผู้ลงมือเขียนเอง
