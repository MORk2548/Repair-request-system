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
packages/core/src/{status.ts, ticket.ts, notify.ts, email.ts, index.ts}   # กฎล้วน ไม่แตะเครือข่าย
packages/core/test/{status.test.ts, ticket.test.ts, notify.test.ts, email.test.ts, parity.test.ts}
packages/api/src/{client.ts, tickets.ts, photos.ts, comments.ts, lookups.ts, admin.ts, errors.ts, database.types.ts}
packages/api/test/*.test.ts                                      # รันกับ Supabase local
supabase/migrations/{0001_schema.sql, 0002_rls.sql, 0003_transition.sql, 0004_reports.sql}
supabase/tests/{ticket_no.sql, rls.sql, transition.sql, reports.sql}
supabase/seed.sql                                                # ข้อมูล dev จากโปรเจกต์ PHP เดิม
supabase/functions/notify-ticket-event/{index.ts, process.ts, process.test.ts, email.ts}
supabase/functions/admin-users/{index.ts, handler.ts, handler.test.ts}
apps/web/app/{login, tickets, tickets/new, tickets/[id]}/page.tsx
apps/web/app/admin/{users, lists, equipment, reports}/page.tsx
apps/web/components/{TicketForm.tsx, TicketTable.tsx, StatusActions.tsx, CommentList.tsx}
apps/mobile/app/{(auth)/login.tsx, (tabs)/tickets.tsx, tickets/new.tsx, tickets/[id].tsx}
apps/mobile/lib/push.ts
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

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** ใน `status.test.ts`:

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

- [ ] **Step 2: ตั้งค่า workspace (pnpm, TypeScript strict, Vitest) แล้วรัน** `pnpm --filter @repair/core test` — คาดว่า FAIL เพราะ `canTransition` ยังไม่มี
- [ ] **Step 3: เขียน `TRANSITIONS`, `canTransition`, `nextStatuses`** ใน `status.ts` ตามตารางข้างบน (`nextStatuses` คืนตามลำดับในตาราง)
- [ ] **Step 4: รัน** `pnpm --filter @repair/core test` — คาดว่า PASS
- [ ] **Step 5: Commit**

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

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (ครอบ Review Focus ข้อ 5):

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

- [ ] **Step 2: รัน** `pnpm --filter @repair/core test ticket` — คาดว่า FAIL
- [ ] **Step 3: เขียน `createTicketSchema` และ type ข้างบน** ใน `ticket.ts` — trim ก่อนนับ, นับความยาวด้วย `[...s].length`, ข้อความผิดพลาดเป็นภาษาไทย (เช่น "กรุณากรอกหัวข้อ")
- [ ] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(core): ticket schema and types"`

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

- [ ] **Step 1: เขียนเทสต์ pgTAP ที่ล้มเหลว**
  - `ticket_no.sql`: `generate_ticket_no('2026-11-30T17:30:00Z')` = `'RQ-2612-0001'` (เวลาไทยข้ามเป็น 1 ธ.ค. แล้ว); เรียกซ้ำเดือนเดียวกัน = `'RQ-2612-0002'`; `'2026-11-30T16:59:00Z'` = `'RQ-2611-0001'`
  - `rls.sql` (ครอบ Review Focus ข้อ 3): ผู้ใช้ A เลือกใบของ B → `is_empty`; technician เห็นเฉพาะใบที่ถูกมอบหมาย; admin เห็นครบ; insert `client_request_id` ซ้ำ → `throws_ok '23505'`; insert รูปที่ 6 → `throws_ok 'photo_limit'`; reporter `update tickets set status = 'closed'` ตรง ๆ ต้องไม่มีผล (0 แถว); technician เห็นใบ `new` ของทุกคน แต่ไม่เห็นใบที่มอบหมายให้ช่างคนอื่นแล้ว; reporter select `technician_options` → `is_empty`; reporter insert `categories` → ถูกปฏิเสธ; บัญชีที่ `is_active = false` select `tickets` → `is_empty`; ใบที่อ้าง `equipment_id` ที่ไม่มีจริง → `throws_ok '23503'`
- [ ] **Step 2: รัน** `supabase test db` — คาดว่า FAIL
- [ ] **Step 3: เขียน migration สองไฟล์** ตาม Interfaces; `generate_ticket_no` ใช้ตาราง `ticket_counters(ym text primary key, last int)` กับ `insert … on conflict do update … returning` เพื่อกันเลขซ้ำเมื่อสร้างพร้อมกัน; ไม่ให้ role `authenticated` มีสิทธิ์ `update` ตรงบน `tickets.status/assignee_id/version` (ต้องผ่าน RPC ใน Task 4)
- [ ] **Step 4: รัน** `supabase test db` — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(db): schema, ticket numbering and RLS"`

---

### Task 4: RPC เปลี่ยนสถานะ (`supabase/migrations/0003_transition.sql`)

**Files:**
- Create: `supabase/migrations/0003_transition.sql`
- Test: `supabase/tests/transition.sql`, `packages/core/test/parity.test.ts`

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

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - `transition.sql`: admin `new → assigned` พร้อม technician สำเร็จ และ `version` เป็น 2; เรียกซ้ำด้วย `p_expected_version = 1` → `throws_ok 'version_conflict'` (Review Focus ข้อ 2); reporter เรียก `new → assigned` → `'forbidden_transition'`; reporter เรียก `done → closed` บนใบของคนอื่น → `'forbidden_transition'`; technician ที่ไม่ใช่ผู้ถูกมอบหมายเรียก `assigned → in_progress` → `'forbidden_transition'`; `new → assigned` ไม่ส่ง assignee → `'assignee_required'`; `in_progress → done` ไม่ส่ง resolution → `'resolution_required'`; หลัง `done` ค่า `resolved_at` ไม่เป็น null และเปิดซ้ำแล้วเป็น null; อุปกรณ์ของใบเป็น `under_repair` ระหว่าง `in_progress`; technician รับใบ `new` ให้ตัวเองสำเร็จ แต่รับให้ช่างคนอื่น → `'forbidden_transition'`; `reassign_ticket` โดยช่างผู้ถูกมอบหมายสำเร็จและ `assignee_id` เป็นคนใหม่, ไม่มีเหตุผล → `'reason_required'`, ช่างที่ไม่ใช่ผู้ถูกมอบหมาย → `'forbidden_transition'`, บนใบ `done` → `'forbidden_transition'`
  - `parity.test.ts`: อ่านตาราง `status_transitions` จาก Supabase local แล้วยืนยันว่าทุก `(from, to, role)` ตรงกับ `TRANSITIONS` เป๊ะ (ไม่ขาดไม่เกิน)
- [ ] **Step 2: รัน** `supabase test db` และ `pnpm --filter @repair/core test parity` — คาดว่า FAIL
- [ ] **Step 3: เขียน `transition_ticket`** เป็น `security definer`, `update … where id = p_ticket_id and version = p_expected_version` (0 แถว → `version_conflict`), ตรวจสิทธิ์จาก `status_transitions` + ความเป็นเจ้าของ
- [ ] **Step 4: รันทั้งสองคำสั่งซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(db): transition_ticket rpc with optimistic locking"`

---

### Task 5: แพ็กเกจ API (`packages/api`)

**Files:**
- Create: `packages/api/src/{client.ts, tickets.ts, photos.ts, comments.ts, errors.ts}`, `packages/api/src/database.types.ts` (gen จาก `supabase gen types typescript --local`)
- Test: `packages/api/test/{tickets,photos,comments}.test.ts`

**Interfaces:**
- Consumes: `CreateTicketInput`, `Ticket`, `TicketStatus` (core); RPC/ตารางจาก Task 3–4
- Produces:
  - `type Db = SupabaseClient<Database>`
  - `createTicket(db: Db, input: CreateTicketInput): Promise<Ticket>` — idempotent ตาม `clientRequestId`
  - `listTickets(db: Db, f: { status?: TicketStatus; limit?: number; cursor?: string }): Promise<{ items: Ticket[]; nextCursor: string | null }>` (เรียงใหม่สุดก่อน, `limit` ค่าเริ่มต้น 20)
  - `getTicket(db: Db, id: string): Promise<TicketDetail>` โดย `TicketDetail = Ticket & { photos: { id: string; url: string }[]; comments: Comment[]; events: TicketEvent[] }` (url เป็น signed URL อายุ 1 ชั่วโมง)
  - `transitionTicket(db: Db, a: { ticketId: string; to: TicketStatus; expectedVersion: number; assigneeId?: string; resolution?: string }): Promise<Ticket>`
  - `addComment(db: Db, ticketId: string, body: string): Promise<Comment>` (body 1–1000 ตัวอักษรหลัง trim)
  - `attachPhoto(db: Db, ticketId: string, file: { data: Blob | ArrayBuffer; mime: string; size: number; name: string }): Promise<{ id: string }>` (เขียน `ticket_attachments` พร้อม `uploader_id` และ `file_name`)
  - `reassignTicket(db: Db, a: { ticketId: string; expectedVersion: number; assigneeId: string; reason: string }): Promise<Ticket>`
  - `lookups.ts`: `listCategories(db)`, `listDepartments(db)`, `listEquipment(db, { q?: string })` (ค้น `asset_tag`/`name` แบบ `ilike`, ไม่เกิน 20 แถว), `listTechnicians(db)` (จาก `technician_options`)
  - error class: `VersionConflictError`, `ForbiddenTransitionError`, `ResolutionRequiredError`, `ReasonRequiredError`, `PhotoLimitError`, `PhotoInvalidError` (mime/ขนาดผิด)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (รันกับ Supabase local ด้วยผู้ใช้ทดสอบสามบทบาท):

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

- [ ] **Step 2: รัน** `pnpm --filter @repair/api test` — คาดว่า FAIL
- [ ] **Step 3: เขียนฟังก์ชันตาม Interfaces** — `createTicket` ใช้ `upsert(..., { onConflict: 'client_request_id', ignoreDuplicates: true })` แล้ว select กลับด้วย `client_request_id`; `attachPhoto` ตรวจ mime/ขนาดฝั่ง client ก่อนอัปโหลด และแปลง exception `photo_limit` / `version_conflict` / `forbidden_transition` เป็น error class ข้างบน
- [ ] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(api): ticket, photo and comment functions"`

---

### Task 6: เว็บ — ล็อกอิน, แจ้งซ่อม, รายการใบของฉัน

**Files:**
- Create: `apps/web/app/login/page.tsx`, `apps/web/app/tickets/page.tsx`, `apps/web/app/tickets/new/page.tsx`, `apps/web/components/{TicketForm.tsx, TicketTable.tsx}`, `apps/web/lib/supabase-server.ts`
- Test: `apps/web/components/TicketForm.test.tsx`

**Interfaces:**
- Consumes: `createTicket`, `attachPhoto`, `listTickets`, `createTicketSchema`
- Produces:
  - `<TicketForm onSubmitted={(t: Ticket) => void} />`
  - `<TicketTable items={Ticket[]} />`
  - เส้นทาง `/login`, `/tickets`, `/tickets/new` (ผู้ไม่ล็อกอินถูก redirect ไป `/login` ผ่าน middleware)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** ด้วย Testing Library โดย mock `@repair/api`:

```tsx
test('shows Thai validation message for empty title and does not call createTicket', /* กดส่งว่าง ๆ → เห็น "กรุณากรอกหัวข้อ" */);
test('double click on submit calls createTicket once and reuses the same clientRequestId on retry', /* … */);
test('photo upload failure keeps the ticket and shows retry button', async () => {
  // createTicket resolves, attachPhoto rejects
  // expect: ข้อความ "สร้างใบแจ้งซ่อมแล้ว แต่อัปโหลดรูปไม่สำเร็จ" + ปุ่ม "ลองอัปโหลดรูปอีกครั้ง"
  // คลิกปุ่ม → attachPhoto ถูกเรียกอีก, createTicket ไม่ถูกเรียกซ้ำ
});
```

- [ ] **Step 2: รัน** `pnpm --filter web test` — คาดว่า FAIL
- [ ] **Step 3: เขียน `TicketForm`** — หมวดเป็น dropdown จาก `listCategories`; ช่องอุปกรณ์ (ไม่บังคับ) ค้นด้วยรหัสทรัพย์สิน/ชื่อผ่าน `listEquipment` เลือกแล้วเติม `location` จาก `install_location` ให้ (แก้ต่อได้); สร้าง `clientRequestId` ครั้งเดียวต่อฟอร์ม (`useRef`), ปิดปุ่มระหว่างส่ง, อัปโหลดรูปหลัง `createTicket` สำเร็จแล้วเท่านั้น, เก็บรูปที่ยังอัปโหลดไม่สำเร็จไว้ใน state ให้ลองใหม่ได้; เขียนหน้า login (อีเมล+รหัสผ่าน; ผิดแสดง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ไม่บอกว่าผิดช่องไหน), `/tickets`, `/tickets/new`
- [ ] **Step 4: รัน** `pnpm --filter web test` — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(web): login, create ticket and my tickets"`

---

### Task 7: เว็บ — รายละเอียดใบ, แดชบอร์ดแอดมิน/ช่าง, เปลี่ยนสถานะ

**Files:**
- Create: `apps/web/app/tickets/[id]/page.tsx`, `apps/web/components/{StatusActions.tsx, CommentList.tsx}`
- Modify: `apps/web/components/TicketTable.tsx` (เพิ่มตัวกรองสถานะ), `apps/web/app/tickets/page.tsx` (admin เห็นทุกใบ, technician มีแท็บ "คิวใบใหม่" และ "งานของฉัน")
- Test: `apps/web/components/StatusActions.test.tsx`

**Interfaces:**
- Consumes: `getTicket`, `transitionTicket`, `addComment`, `nextStatuses`, `VersionConflictError`
- Produces:
  - `<StatusActions ticket={Ticket} role={Role} technicians={{ id: string; displayName: string }[]} onChanged={(t: Ticket) => void} />` — แสดงปุ่มเฉพาะสถานะที่ `nextStatuses(ticket.status, role)` อนุญาต; ปุ่ม "มอบหมายช่าง" เปิดตัวเลือกช่าง (admin); technician บนใบ `new` เห็นปุ่ม "รับงาน" (ส่ง `assigneeId` = ตัวเอง); เมื่อ `canReassign(...)` และผู้ใช้เป็นช่างผู้ถูกมอบหมายหรือ admin แสดงปุ่ม "ส่งต่อช่างคนอื่น" เปิดตัวเลือกช่าง (ไม่รวมคนปัจจุบัน) + ช่องเหตุผลบังคับ

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```tsx
test('reporter on a done ticket sees only "ปิดงาน" and "ขอแก้ไขใหม่"', /* … */);
test('closed ticket renders no action buttons', /* … */);
test('technician on a new ticket sees "รับงาน" and it assigns to themself', /* … */);
test('"ส่งต่อช่างคนอื่น" requires a reason and excludes the current technician from the list', /* … */);
test('VersionConflictError shows "มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่" and a reload button, ticket state unchanged', /* … */);
```

- [ ] **Step 2: รัน** `pnpm --filter web test StatusActions` — คาดว่า FAIL
- [ ] **Step 3: เขียน `StatusActions`, `CommentList` และหน้า detail** — ส่ง `expectedVersion = ticket.version` ทุกครั้ง; ตอนชน version ให้ refetch เมื่อกดปุ่มโหลดใหม่ ไม่ refetch เงียบ ๆ; ปุ่ม "เสร็จงาน" เปิดช่องกรอกวิธีแก้ไขก่อนส่ง (ตรวจด้วย `resolutionSchema`); หน้า detail แสดงอุปกรณ์ วิธีแก้ไข และวันที่แก้ไขเสร็จ
- [ ] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS (เพิ่มเคส: กด "เสร็จงาน" โดยไม่กรอกวิธีแก้ไข → เห็น "กรุณากรอกวิธีแก้ไข" และไม่เรียก `transitionTicket`)
- [ ] **Step 5: Commit** `git commit -m "feat(web): ticket detail, status actions and staff dashboard"`

---

### Task 7.5: เว็บ — หน้า admin (ผู้ใช้, แผนก, หมวด, อุปกรณ์)

**Files:**
- Create: `supabase/functions/admin-users/{index.ts, handler.ts}`, `packages/api/src/admin.ts`, `apps/web/app/admin/{users,lists,equipment}/page.tsx`
- Modify: `apps/web/middleware.ts` (ผู้ที่ไม่ใช่ admin เข้า `/admin/*` → redirect `/tickets`)
- Test: `supabase/functions/admin-users/handler.test.ts`

**Interfaces:**
- Consumes: ตาราง `profiles`, `departments`, `categories`, `equipment` (Task 3)
- Produces:
  - Edge Function `admin-users` (service-role จาก secret เท่านั้น; ตรวจก่อนว่าผู้เรียกเป็น admin ที่ active):
    - `create { email, displayName, role, departmentId }` → `auth.admin.inviteUserByEmail` แล้วสร้าง `profiles`
    - `update { userId, role?, departmentId?, isActive? }` → `isActive = false` สั่ง `ban_duration` ใน Auth ด้วย; `true` ยกเลิก ban
  - `handler.ts` ไม่ import ของ Deno (แบบเดียวกับ `process.ts`) รับ deps `{ getCaller, inviteUser, upsertProfile, setBan }`
  - `admin.ts`: `adminCreateUser(db, input)`, `adminUpdateUser(db, input)` เรียก Edge Function; CRUD lookup เขียนตรงผ่าน RLS (admin เท่านั้น)
  - `/admin/lists`: แผนกและหมวด เพิ่ม/แก้/ปิดใช้งาน (ไม่ลบ เพราะมีใบเก่าอ้างอยู่); `/admin/equipment`: รายการ + ฟอร์มเพิ่ม/แก้อุปกรณ์

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
test('non-admin caller gets 403 and no Auth API is called', /* … */);
test('inactive admin caller gets 403', /* … */);
test('admin cannot deactivate their own account (400)', /* … */);
test('duplicate email returns Thai error "อีเมลนี้มีผู้ใช้แล้ว"', /* … */);
test('deactivating a user also bans them in Auth', /* … */);
```

- [ ] **Step 2: รัน** `pnpm exec vitest run handler` — คาดว่า FAIL
- [ ] **Step 3: เขียน handler, index.ts, admin.ts และหน้า admin ทั้งสาม**
- [ ] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(web): admin pages for users, lists and equipment"`

---

### Task 7.6: เว็บ — หน้าสรุปรายงานของ admin

**Files:**
- Create: `supabase/migrations/0004_reports.sql`, `apps/web/app/admin/reports/page.tsx`, `packages/api/src/reports.ts`
- Test: `supabase/tests/reports.sql`

**Interfaces:**
- Consumes: `tickets`, `categories`, `profiles` (Task 3)
- Produces:
  - `ticket_summary(p_from date, p_to date) returns jsonb` (security definer; ผู้เรียกที่ไม่ใช่ admin active → exception `forbidden`): นับใบที่ `created_at` อยู่ในช่วง (ตามวันเวลา `Asia/Bangkok`, รวมทั้งสองวัน) แยกตามสถานะ หมวด และช่าง และ `avg_resolve_hours` = ค่าเฉลี่ย `resolved_at - created_at` ของใบที่มี `resolved_at`
  - `getTicketSummary(db, { from: string; to: string })` ใน `reports.ts`
  - `/admin/reports`: เลือกช่วงวันที่ (ค่าเริ่มต้น = เดือนปัจจุบัน) แล้วแสดงตารางตัวเลข ไม่มีกราฟ

- [ ] **Step 1: เขียนเทสต์ pgTAP ที่ล้มเหลว** ใน `reports.sql`: seed 3 ใบในช่วงและ 1 ใบนอกช่วง → นับได้ 3; ใบที่สร้าง `2026-11-30T17:30:00Z` นับเป็นวันที่ 1 ธ.ค.; ใบ `done` 2 ใบใช้เวลา 2 และ 4 ชั่วโมง → `avg_resolve_hours = 3`; reporter เรียก → `throws_ok 'forbidden'`
- [ ] **Step 2: รัน** `supabase test db` — คาดว่า FAIL
- [ ] **Step 3: เขียน `ticket_summary`, `getTicketSummary` และหน้า `/admin/reports`**
- [ ] **Step 4: รันซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat: admin ticket summary report"`

---

### Task 8: แจ้งเตือน (Edge Function + กฎผู้รับ)

**Files:**
- Create: `packages/core/src/notify.ts`, `supabase/functions/notify-ticket-event/{index.ts, process.ts}`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/notify.test.ts`, `supabase/functions/notify-ticket-event/process.test.ts` (Vitest ที่ root ครอบ `supabase/functions/**/*.test.ts`)

**Interfaces:**
- Consumes: ตาราง `ticket_events`, `profiles.expo_push_token`
- Produces:
  - `recipientsFor(e: { toStatus: TicketStatus; actorId: string }, t: { reporterId: string; assigneeId: string | null }, staff: { adminIds: string[]; technicianIds: string[] }): string[]` — ไม่มีรายการซ้ำ และไม่รวม `actorId` (ส่งต่องานใช้ event `to_status = 'assigned'` จึงแจ้งช่างคนใหม่ + ผู้แจ้งด้วยกติกาเดียวกัน)
  - `messageFor(toStatus: TicketStatus, ticketNo: string): { title: string; body: string }` (ภาษาไทย)
    - `type Deps = { loadTicket(id: string): Promise<Ticket>; listStaffIds(): Promise<{ adminIds: string[]; technicianIds: string[] }>; getContact(userId: string): Promise<{ pushToken: string | null }>; sendPush(token: string, m: { title: string; body: string; ticketId: string }): Promise<void> }`
  - `processEvent(e: { id: string; ticketId: string; actorId: string; toStatus: TicketStatus }, deps: Deps): Promise<void>` — ไม่ import อะไรเฉพาะ Deno เพื่อให้ Vitest รันได้
  - `index.ts` รับ Database Webhook เมื่อ insert `ticket_events` แล้วเรียก `processEvent` พร้อม deps จริง (ส่ง Expo push ผ่าน `https://exp.host/--/api/v2/push/send`)

กติกาผู้รับ (เฉพาะบัญชีที่ `is_active`): `new` → ผู้ดูแลและช่างทุกคน (คิวรอรับงาน); `assigned` → ช่างที่ได้รับมอบหมาย + ผู้แจ้ง; `in_progress`, `done` → ผู้แจ้ง (+ ผู้ดูแลเมื่อ `done`); `closed`, `cancelled` → ช่างที่เกี่ยวข้อง + ผู้ดูแล

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
test('new ticket notifies all admins and technicians except the actor', () =>
  expect(recipientsFor({ toStatus: 'new', actorId: 'a1' }, { reporterId: 'r1', assigneeId: null }, { adminIds: ['a1', 'a2'], technicianIds: ['t1'] }).sort()).toEqual(['a2', 't1']));
test('assigned notifies technician and reporter', () =>
  expect(recipientsFor({ toStatus: 'assigned', actorId: 'a1' }, { reporterId: 'r1', assigneeId: 't1' }, { adminIds: ['a1'], technicianIds: ['t1', 't2'] }).sort()).toEqual(['r1', 't1']));
test('technician taking a ticket themself notifies only the reporter', /* actor t1 = assignee → ['r1'] */);
test('no duplicates when reporter is also admin', /* … */);
test('actor never notified of own action', /* … */);
// process.test.ts
test('processEvent pushes to every recipient that has a token and skips those without', /* … */);
test('a push failure for one recipient does not stop the others', /* … */);
```

- [ ] **Step 2: รัน** `pnpm --filter @repair/core test notify` และ `pnpm exec vitest run process` — คาดว่า FAIL
- [ ] **Step 3: เขียน `recipientsFor`, `messageFor`, `processEvent` และ `index.ts`** (`index.ts` ใช้ service-role key จาก secret ของ Supabase เท่านั้น; ถ้า push ของผู้รับคนใดล้มเหลวให้ log แล้วไปคนถัดไป ไม่ throw เพื่อไม่ให้ webhook ลองซ้ำจนส่งซ้ำ)
- [ ] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat: ticket event notifications"`

---

### Task 9: อีเมลแจ้งเตือน

**Files:**
- Create: `packages/core/src/email.ts`, `supabase/functions/notify-ticket-event/email.ts`
- Modify: `packages/core/src/index.ts`, `supabase/functions/notify-ticket-event/process.ts` (ส่งอีเมลควบคู่ push), `supabase/functions/notify-ticket-event/index.ts` (ต่อ deps จริง)
- Test: `packages/core/test/email.test.ts`, `supabase/functions/notify-ticket-event/process.test.ts` (เพิ่มเคส)

**Interfaces:**
- Consumes: `recipientsFor`, `messageFor`, `processEvent`, `Deps` (Task 8); `TicketStatus`
- Produces:
  - `escapeHtml(s: string): string` — แทน `& < > " '` ด้วย entity
  - `buildEmail(toStatus: TicketStatus, t: { id: string; ticketNo: string; title: string }, baseUrl: string): { subject: string; text: string; html: string }` — `subject` = `[แจ้งซ่อม] ` + `messageFor(toStatus, t.ticketNo).title`; `text`/`html` มีข้อความจาก `messageFor(...).body`, หัวข้อใบ และลิงก์ `{baseUrl}/tickets/{id}` (ตัด `/` ท้าย `baseUrl` ก่อนต่อ); `text` ใช้หัวข้อดิบ, `html` ใช้หัวข้อที่ผ่าน `escapeHtml`
  - `Deps` ขยาย: `getContact` คืน `{ pushToken: string | null; email: string | null }` และเพิ่ม `sendEmail(to: string, mail: { subject: string; text: string; html: string }, idempotencyKey: string): Promise<void>`
  - `sendEmail` จริง (`email.ts`): `POST ${RESEND_API_URL ?? 'https://api.resend.com/emails'}` พร้อม header `Authorization: Bearer ${RESEND_API_KEY}` และ `Idempotency-Key`, body `{ from: EMAIL_FROM, to: [to], subject, text, html }`; สถานะตอบกลับที่ไม่ใช่ 2xx → throw
  - คีย์กันส่งซ้ำ: `${event.id}:${userId}`; `getContact` จริงอ่านอีเมลจาก `supabase.auth.admin.getUserById`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

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
```

- [ ] **Step 2: รัน** `pnpm exec vitest run email process` — คาดว่า FAIL
- [ ] **Step 3: เขียน `escapeHtml`, `buildEmail`, ขยาย `processEvent` และ `sendEmail`** — ส่ง push กับอีเมลของผู้รับแต่ละคนด้วย `Promise.allSettled` และ log ความล้มเหลวโดยไม่ throw
- [ ] **Step 4: รันเทสต์ซ้ำ** — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat: email notifications via Resend"`

---

### Task 10: แอป — ล็อกอิน, แจ้งซ่อมพร้อมถ่ายรูป, รายการใบ

**Files:**
- Create: `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(tabs)/tickets.tsx`, `apps/mobile/app/tickets/new.tsx`, `apps/mobile/lib/supabase.ts` (เก็บ session ด้วย `expo-secure-store`)
- Test: `apps/mobile/app/tickets/new.test.tsx`

**Interfaces:**
- Consumes: `createTicket`, `attachPhoto`, `listTickets`, `createTicketSchema`
- Produces: หน้าจอ `/login`, `/(tabs)/tickets` (ดึงเพิ่มเมื่อเลื่อนสุดด้วย `nextCursor`), `/tickets/new` (เลือกรูปจากกล้อง/คลัง สูงสุด 5 รูป)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** ด้วย jest-expo + RNTL (mock `@repair/api`, `expo-image-picker`):

```tsx
test('shows Thai validation errors and blocks submit when form is empty', /* … */);
test('selecting a 6th photo is refused with "แนบรูปได้ไม่เกิน 5 รูป"', /* … */);
test('photo failure keeps ticket, shows retry; retry does not call createTicket again', /* … */);
test('draft text survives a failed createTicket (network error) and can be resubmitted with same clientRequestId', /* … */);
```

- [ ] **Step 2: รัน** `pnpm --filter mobile test` — คาดว่า FAIL
- [ ] **Step 3: เขียนหน้าจอทั้งสาม** — ใช้ตรรกะเดียวกับ `TicketForm` (หมวดจาก `listCategories`, เลือกอุปกรณ์ได้) (สร้าง `clientRequestId` ครั้งเดียวต่อฟอร์ม, อัปโหลดรูปหลังสร้างใบ); ย่อรูปก่อนอัปโหลดด้วย `expo-image-manipulator` ให้ไม่เกิน 5 MB
- [ ] **Step 4: รัน** `pnpm --filter mobile test` — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(mobile): login, create ticket with photos, ticket list"`

---

### Task 11: แอป — รายละเอียดใบ, ปุ่มเปลี่ยนสถานะ, push token

**Files:**
- Create: `apps/mobile/app/tickets/[id].tsx`, `apps/mobile/lib/push.ts`
- Test: `apps/mobile/app/tickets/detail.test.tsx`, `apps/mobile/lib/push.test.ts`

**Interfaces:**
- Consumes: `getTicket`, `transitionTicket`, `addComment`, `nextStatuses`, `VersionConflictError`
- Produces:
  - `registerPushToken(db: Db, userId: string): Promise<'registered' | 'denied' | 'unsupported'>` — ขอสิทธิ์แจ้งเตือน, อ่าน Expo push token, บันทึกลง `profiles.expo_push_token`
  - หน้ารายละเอียดที่ใช้กฎเดียวกับเว็บ (ปุ่มจาก `nextStatuses`, ข้อความชนเวอร์ชันเหมือน Task 7); แตะการแจ้งเตือนแล้วเปิดใบที่เกี่ยวข้อง (`data.ticketId`)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**:

```ts
test('registerPushToken returns "denied" and writes nothing when permission refused', /* … */);
test('registerPushToken returns "unsupported" on simulator/no device', /* … */);
test('registerPushToken saves token to profiles for the current user', /* … */);
// detail.test.tsx
test('technician assigned to ticket sees "เริ่มงาน" on assigned ticket', /* … */);
test('VersionConflictError shows reload message', /* … */);
```

- [ ] **Step 2: รัน** `pnpm --filter mobile test` — คาดว่า FAIL
- [ ] **Step 3: เขียน `push.ts` และหน้ารายละเอียด**
- [ ] **Step 4: รัน** `pnpm --filter mobile test` — คาดว่า PASS
- [ ] **Step 5: Commit** `git commit -m "feat(mobile): ticket detail, status actions and push registration"`

---

### Task 12: ปล่อยใช้งานและ smoke test

**Files:**
- Create: `e2e/smoke.spec.ts`, `playwright.config.ts`, `.env.example`, `README.md` (ขั้นตอนตั้งค่า Supabase/Vercel/EAS)
- Modify: `apps/web/next.config.ts` (ถ้าจำเป็น)

**Interfaces:**
- Consumes: ทุก Task ก่อนหน้า
- Produces: เว็บ deploy บน Vercel, ฐานข้อมูล/Edge Function บน Supabase project จริง, แอป build ด้วย EAS (internal distribution)

- [ ] **Step 1: เขียน Playwright smoke** ที่ล้มเหลว: reporter ล็อกอิน → สร้างใบแจ้งซ่อมพร้อมรูป → เห็นเลข `RQ-` ในรายการ; admin ล็อกอิน → มอบหมายช่าง → ช่างล็อกอิน → `ส่งต่อช่างคนอื่น` พร้อมเหตุผล → ช่างคนใหม่ล็อกอิน → `เริ่มงาน` → `เสร็จงาน`; (ช่องวิธีแก้ไขว่างต้องกดส่งไม่ได้); reporter เลือกอุปกรณ์ตอนแจ้งแล้วเห็นในหน้า detail; admin ปิดบัญชีผู้ใช้หนึ่งคนแล้วผู้ใช้นั้นล็อกอินไม่ได้; reporter `ปิดงาน` แล้วใบอยู่สถานะ `closed` และไม่มีปุ่มเหลือ; ระหว่างทางตรวจว่าเซิร์ฟเวอร์จำลอง Resend (ตั้ง `RESEND_API_URL` ชี้มาที่เทสต์) ได้รับอีเมลถึงผู้แจ้งตอน `assigned` และ `done`
- [ ] **Step 2: รัน** `pnpm exec playwright test` กับ Supabase local — คาดว่า FAIL จนกว่า seed ผู้ใช้ทดสอบสามบทบาท (`supabase/seed.sql`) จะพร้อม
- [ ] **Step 3: เพิ่ม seed, `.env.example`, README;** `supabase/seed.sql` (โหลดโดย `supabase db reset` เท่านั้น) คัดจาก `Repair System/database/seed.sql`:
  - `departments`: 7 แผนก (ใช้ `name_th`)
  - ผู้ใช้ 10 คน (อีเมล `@helpdesk.test` ชุดเดิม): insert `auth.users` + `auth.identities` ด้วย `crypt('<dev password>', gen_salt('bf'))` และ uuid คงที่ แล้ว insert `profiles` ด้วยชื่อ บทบาทที่แมปแล้ว (admin 1, technician 3, reporter 6) และแผนก; รหัสผ่าน dev เขียนไว้หัว `seed.sql` และ README
  - `categories`: ไฟฟ้า, ประปา, เครื่องปรับอากาศ, เฟอร์นิเจอร์, เครือข่าย, อื่น ๆ; `equipment`: ตัวอย่าง 5–6 รายการกระจายแผนก
  - ไม่นำ `branches`, `notifications`, `login_attempts`, การตั้งค่าธีม/ภาษา หรือใบงานจาก `tests/fixtures.sql` มา
  
  จากนั้น ตั้งค่า secrets ของ Edge Function (`RESEND_API_KEY`, `EMAIL_FROM`, `WEB_BASE_URL`) และ Database Webhook; ยืนยันโดเมนผู้ส่งกับ Resend (SPF/DKIM); deploy** ด้วย `supabase db push`, `supabase functions deploy notify-ticket-event`, `vercel deploy --prod`, `eas build --profile preview`
- [ ] **Step 4: รัน** `pnpm exec playwright test` — คาดว่า PASS; แล้วลองบนมือถือจริงหนึ่งเครื่อง: สร้างใบ → admin มอบหมาย → ได้ push และอีเมลภายใน 1 นาที (ตรวจว่าอีเมลไม่เข้าสแปม)
- [ ] **Step 5: Commit** `git commit -m "chore: e2e smoke test and deployment docs"`

---

## Self-Review

1. **Spec coverage:** แจ้งซ่อม+รูป (T5, 6, 10), มอบหมาย/อัปเดตสถานะ + วิธีแก้ไข (T4, 7, 11), สิทธิ์ตามบทบาทและบัญชีที่ปิดใช้งาน (T3, 4, 7.5), แผนก/หมวด/อุปกรณ์ตาม ER (T3, 5, 7.5), รับงานเอง/ส่งต่อช่างตาม flow chart (T1, 3, 4, 7), รายงานสรุป (T7.6), แจ้งเตือน push (T8, 11) และอีเมล (T9), เว็บ (T6–7.5), แอป (T10–11), seed จากโปรเจกต์เดิม + ปล่อยใช้งาน (T12) — ครบตาม Assumptions และ ER
2. **Step scan:** แต่ละ step ระบุไฟล์ ลายเซ็น หรือค่าที่ spec กำหนดครบ ไม่มีเนื้อฟังก์ชันที่ลายเซ็นกับเทสต์ตัดสินไปแล้ว
3. **Type consistency:** ใช้ `Ticket`, `CreateTicketInput`, `TicketStatus`, `Role`, `Db`, `transitionTicket`, `VersionConflictError` ชื่อเดียวกันทุก task; กฎสถานะมีที่มาเดียว (`TRANSITIONS` ↔ `status_transitions`) และมี parity test บังคับให้ตรงกัน
4. **Review Focus:** ทั้งห้าข้อมีเทสต์ใน task ที่ระบุไว้
5. **Proportion:** โค้ดในแผนเป็นเทสต์และลายเซ็นเท่านั้น ส่วนเนื้อฟังก์ชันให้ผู้ลงมือเขียนเอง
