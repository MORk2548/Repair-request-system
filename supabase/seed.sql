-- Development data, loaded only by `supabase db reset`. Taken from the old PHP helpdesk seed.
-- Every account below signs in with the dev password: helpdesk-dev

-- ids are left to the identity columns so rows the tests insert later never collide with them
insert into public.departments (name) values
  ('ฝ่ายขาย'),
  ('ฝ่ายบุคคล'),
  ('ฝ่ายบัญชี'),
  ('ฝ่ายปฏิบัติการ'),
  ('ฝ่ายการตลาด'),
  ('ฝ่ายจัดซื้อ'),
  ('ฝ่ายเทคโนโลยีสารสนเทศ');

create temporary table seed_users (id uuid, email text, display_name text, role public.app_role, department text);
insert into seed_users values
  ('5eed0000-0000-0000-0000-000000000001', 'admin@helpdesk.test', 'ผู้ดูแลระบบ', 'admin', 'ฝ่ายเทคโนโลยีสารสนเทศ'),
  ('5eed0000-0000-0000-0000-000000000002', 'kittipong@helpdesk.test', 'กิตติพงษ์ รักงาน', 'technician', 'ฝ่ายเทคโนโลยีสารสนเทศ'),
  ('5eed0000-0000-0000-0000-000000000003', 'orathai@helpdesk.test', 'อรทัย มีสุข', 'technician', 'ฝ่ายเทคโนโลยีสารสนเทศ'),
  ('5eed0000-0000-0000-0000-000000000004', 'nattapon@helpdesk.test', 'ณัฐพล ทองดี', 'technician', 'ฝ่ายเทคโนโลยีสารสนเทศ'),
  ('5eed0000-0000-0000-0000-000000000005', 'nattawut@helpdesk.test', 'ณัฐวุฒิ ใจดี', 'reporter', 'ฝ่ายขาย'),
  ('5eed0000-0000-0000-0000-000000000006', 'pimchanok@helpdesk.test', 'พิมพ์ชนก วงศ์ดี', 'reporter', 'ฝ่ายบุคคล'),
  ('5eed0000-0000-0000-0000-000000000007', 'thanaporn@helpdesk.test', 'ธนพร ศรีสุข', 'reporter', 'ฝ่ายบัญชี'),
  ('5eed0000-0000-0000-0000-000000000008', 'warin@helpdesk.test', 'วรินทร์ แสงทอง', 'reporter', 'ฝ่ายปฏิบัติการ'),
  ('5eed0000-0000-0000-0000-000000000009', 'suppachai@helpdesk.test', 'ศุภชัย มั่นคง', 'reporter', 'ฝ่ายการตลาด'),
  ('5eed0000-0000-0000-0000-000000000010', 'orathai.k@helpdesk.test', 'อรทัย แก้วใส', 'reporter', 'ฝ่ายจัดซื้อ');

-- GoTrue fails to sign in a user whose token columns are NULL, so they are set to ''
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('helpdesk-dev', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', display_name), now(), now(),
  '', '', '', ''
from seed_users;

insert into auth.identities (provider, provider_id, user_id, identity_data, last_sign_in_at, created_at, updated_at)
select 'email', id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from seed_users;

insert into public.profiles (id, display_name, role, department_id)
select u.id, u.display_name, u.role, d.id
from seed_users u join public.departments d on d.name = u.department;

drop table seed_users;

insert into public.categories (name, sort_order) values
  ('ไฟฟ้า', 1),
  ('ประปา', 2),
  ('เครื่องปรับอากาศ', 3),
  ('เฟอร์นิเจอร์', 4),
  ('เครือข่าย', 5),
  ('อื่น ๆ', 99);

insert into public.equipment (asset_tag, name, serial_no, department_id, install_location)
select e.asset_tag, e.name, e.serial_no, d.id, e.install_location
from (values
  ('AC-0001', 'แอร์ห้องประชุมใหญ่', 'DK-FTKC18', 'ฝ่ายขาย', 'อาคาร A ชั้น 2 ห้องประชุมใหญ่'),
  ('AC-0002', 'แอร์ห้องบัญชี', 'MS-SRK13', 'ฝ่ายบัญชี', 'อาคาร A ชั้น 3 ห้องบัญชี'),
  ('PR-0001', 'เครื่องพิมพ์ HP LaserJet', 'HP-M404DN', 'ฝ่ายบุคคล', 'อาคาร A ชั้น 1 ห้องบุคคล'),
  ('PR-0002', 'เครื่องพิมพ์ Epson L3250', 'EP-L3250', 'ฝ่ายจัดซื้อ', 'อาคาร B ชั้น 1 ห้องจัดซื้อ'),
  ('PM-0001', 'ปั๊มน้ำอาคาร B', 'GF-WP205', 'ฝ่ายปฏิบัติการ', 'อาคาร B ห้องเครื่องชั้นใต้ดิน'),
  ('SW-0001', 'สวิตช์เครือข่ายชั้น 2', 'CS-2960X', 'ฝ่ายเทคโนโลยีสารสนเทศ', 'อาคาร A ชั้น 2 ห้อง Server')
) as e (asset_tag, name, serial_no, department, install_location)
join public.departments d on d.name = e.department;

-- Wires notify_ticket_event() (0007_notify.sql) to the local Edge Function. kong is the API gateway's name
-- on the Docker network the database runs in. The secret must equal NOTIFY_WEBHOOK_SECRET in
-- supabase/functions/.env.
select vault.create_secret('http://kong:8000/functions/v1/notify-ticket-event', 'notify_function_url');
select vault.create_secret('local-dev-notify-secret', 'notify_webhook_secret');

-- Wires request_photo_purge() (0012_ticket_delete_photo_purge.sql), which pg_cron runs daily, to the local purge-photos function.
select vault.create_secret('http://kong:8000/functions/v1/purge-photos', 'purge_function_url');
