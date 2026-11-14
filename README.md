# ระบบแจ้งซ่อม

ระบบแจ้งซ่อมภายในองค์กร ผู้แจ้งส่งใบแจ้งซ่อมพร้อมรูปผ่านเว็บหรือแอปมือถือ ช่างรับงาน บันทึกวิธีแก้ไข และส่งต่องานได้ ผู้ดูแลระบบจัดการผู้ใช้ แผนก หมวด อุปกรณ์ และดูรายงานสรุป

- เว็บ: Next.js 15 (`apps/web`)
- แอปมือถือ: Expo (`apps/mobile`) ใช้ได้ทั้ง Android และ iPhone
- ฐานข้อมูล ล็อกอิน เก็บรูป และฟังก์ชันฝั่งเซิร์ฟเวอร์: Supabase (`supabase/`)

แผนงานทั้งหมดอยู่ที่ `docs/plan.md` รายละเอียดสำหรับนักพัฒนาอยู่ที่ `AGENTS.md`

## เปิดใช้ในเครื่อง (PowerShell)

ต้องมี Node 20 ขึ้นไป และเปิด Docker Desktop ไว้

```powershell
corepack pnpm install
corepack pnpm db:start
corepack pnpm db:reset
Copy-Item apps\web\.env.example apps\web\.env.local
```

ใส่ `ANON_KEY` จาก `corepack pnpm exec supabase status -o env` ลงใน `apps\web\.env.local` แล้วเปิดเว็บ

```powershell
corepack pnpm web:dev
```

เข้า http://localhost:3000 ด้วยบัญชีทดสอบใน `supabase/seed.sql` (รหัสผ่านอยู่หัวไฟล์) บัญชีทดสอบมีเฉพาะในเครื่อง ห้ามนำขึ้นระบบจริง เพราะรหัสผ่านอยู่ใน repo

## ขึ้นระบบจริง

### 1. Supabase (ฐานข้อมูลบน cloud)

สร้าง project ใหม่ที่ supabase.com แล้ว

```powershell
corepack pnpm exec supabase login
corepack pnpm exec supabase link --project-ref <project-ref>
corepack pnpm exec supabase db push --remote
corepack pnpm exec supabase functions deploy admin-users notify-ticket-event --remote
corepack pnpm exec supabase secrets set NOTIFY_WEBHOOK_SECRET=<ค่าสุ่มยาว> WEB_BASE_URL=<ที่อยู่เว็บจริง> --remote
```

แจ้งเตือนขึ้นหน้าจอ (Web Push) ฟรีและไม่ต้องมีโดเมน สร้างกุญแจครั้งเดียวด้วย `npx web-push@3.6.7 generate-vapid-keys` แล้วตั้งค่า (ห้ามเอา private key ไปไว้ที่ Vercel หรือใน repo)

```powershell
corepack pnpm exec supabase secrets set VAPID_SUBJECT=<ที่อยู่เว็บจริง> VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key> --remote
```

คำสั่งของ Supabase CLI ต้องมี `--remote` ไม่งั้นจะทำกับฐานข้อมูลในเครื่อง

จากนั้นรันใน SQL editor ของ project (ค่า secret ต้องตรงกับ `NOTIFY_WEBHOOK_SECRET`)

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify-ticket-event', 'notify_function_url');
select vault.create_secret('<ค่าเดียวกับ NOTIFY_WEBHOOK_SECRET>', 'notify_webhook_secret');
```

ตั้งค่าในหน้า project (ห้ามใช้ `supabase config push` เพราะจะเอาค่าสำหรับเครื่องพัฒนาขึ้นไปด้วย เช่น ปิดการยืนยันอีเมล)

- Authentication → URL Configuration: Site URL = ที่อยู่เว็บจริง และเพิ่ม Redirect URL `<ที่อยู่เว็บจริง>/**`
- Authentication → Emails → SMTP Settings: เปิด custom SMTP (ต้องเปิดก่อนจึงแก้เทมเพลตได้) ถ้าใช้ Gmail ต้องใช้ App Password ไม่ใช่รหัสผ่านปกติ
- Authentication → Emails → Templates → Invite user: ใช้หัวเรื่องและเนื้อหาจาก `supabase/templates/invite.html` ลิงก์ต้องเป็น `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite`

admin คนแรก: สร้างผู้ใช้ใน Authentication → Users → Add user แล้วเพิ่มแถวใน `profiles` ด้วย `role = 'admin'` ผู้ใช้คนอื่นให้ admin เชิญจากหน้า "ผู้ใช้" บนเว็บ

### 2. เว็บบน Vercel

1. ที่ vercel.com กด Add New → Project แล้วเลือก repo นี้จาก GitHub
2. Root Directory: `apps/web` (Framework จะขึ้นเป็น Next.js เอง)
3. Environment Variables
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key ของ project (Project Settings → API) ห้ามใช้ service role key
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = public key ตัวเดียวกับ `VAPID_PUBLIC_KEY` (ถ้าไม่ใส่ หน้า "ตั้งค่า" จะบอกว่าไม่รองรับการแจ้งเตือนขึ้นหน้าจอ)
4. กด Deploy
5. เอาที่อยู่ที่ได้ (เช่น `https://<ชื่อ>.vercel.app`) ไปใส่ใน Site URL และ Redirect URL ของ Supabase และตั้ง `WEB_BASE_URL` ของฟังก์ชันใหม่ด้วยคำสั่ง `secrets set` ข้างบน

`apps/web/vercel.json` ให้เซิร์ฟเวอร์ของเว็บรันที่มุมไบ (`bom1`) ข้างฐานข้อมูล Supabase (`ap-south-1`) ถ้าสร้าง project Supabase ในภูมิภาคอื่น ให้เปลี่ยนค่านี้ตาม เพราะทุกหน้าคุยกับฐานข้อมูลหลายรอบ

ถ้าขั้นติดตั้งบน Vercel ใช้ pnpm คนละรุ่นกับ `packageManager` ใน `package.json` ให้เพิ่ม Environment Variable `ENABLE_EXPERIMENTAL_COREPACK` = `1`

### 3. แอปมือถือ

ดู Task 12.3 ใน `docs/plan.md` (ต้องมีบัญชี Expo และ `npx eas init` ใน `apps/mobile`)
