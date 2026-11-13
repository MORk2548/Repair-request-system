import { expect, test, type Browser, type Page } from '@playwright/test';
import { RESEND_MOCK_PORT } from './resend-mock';

const PASSWORD = 'helpdesk-dev';
const REPORTER = 'nattawut@helpdesk.test';
const ADMIN = 'admin@helpdesk.test';
const FIRST_TECH = { email: 'kittipong@helpdesk.test', name: 'กิตติพงษ์ รักงาน' };
const SECOND_TECH = { email: 'orathai@helpdesk.test', name: 'อรทัย มีสุข' };
const DEACTIVATED = 'orathai.k@helpdesk.test';

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const TITLE = `e2e smoke ${RUN_ID}`;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill(email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(/\/tickets/);
  return page;
}

const actions = (page: Page) => page.getByRole('region', { name: 'จัดการใบแจ้งซ่อม' });
const statusBadge = (page: Page, label: string) =>
  page.getByRole('heading', { level: 1, name: TITLE }).locator('..').getByText(label, { exact: true });

type SentEmail = { to: string[]; subject: string; text: string };

async function emailsAbout(status: string): Promise<SentEmail[]> {
  const res = await fetch(`http://127.0.0.1:${RESEND_MOCK_PORT}/emails`);
  const all = (await res.json()) as SentEmail[];
  return all.filter((m) => m.text.includes(`หัวข้อ: ${TITLE}`) && m.text.includes(`สถานะ: ${status}`));
}

test.describe('full ticket cycle', () => {
  test.describe.configure({ mode: 'serial' });

  let ticketUrl = '';

  test('reporter files a ticket with a photo and equipment', async ({ browser }) => {
    const page = await signIn(browser, REPORTER);
    await page.getByRole('link', { name: 'แจ้งซ่อม', exact: true }).click();
    await page.getByLabel('หัวข้อ').fill(TITLE);
    await page.getByLabel('รายละเอียด').fill('แอร์ไม่เย็น มีน้ำหยด');
    await page.getByLabel('หมวดหมู่').selectOption({ label: 'เครื่องปรับอากาศ' });
    await page.getByLabel('อุปกรณ์ (ไม่บังคับ)').fill('AC-0001');
    await page.getByRole('button', { name: 'AC-0001 แอร์ห้องประชุมใหญ่' }).click();
    await expect(page.getByLabel('สถานที่')).toHaveValue('อาคาร A ชั้น 2 ห้องประชุมใหญ่');
    await page.getByLabel('รูป', { exact: true }).setInputFiles({ name: 'aircon.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await page.getByRole('button', { name: 'ส่งใบแจ้งซ่อม' }).click();

    await expect(page).toHaveURL(/\/tickets$/);
    const row = page.getByRole('row').filter({ hasText: TITLE });
    await expect(row.getByRole('link', { name: /^RQ-/ })).toBeVisible();
    await row.getByRole('link', { name: /^RQ-/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    ticketUrl = page.url();

    await expect(page.getByText('AC-0001 แอร์ห้องประชุมใหญ่')).toBeVisible();
    await expect(page.getByRole('img', { name: /^รูปที่ 1 ของใบ RQ-/ })).toBeVisible();
    await expect(statusBadge(page, 'ใหม่')).toBeVisible();
  });

  test('admin assigns the first technician', async ({ browser }) => {
    const page = await signIn(browser, ADMIN);
    await page.goto(ticketUrl);
    await actions(page).getByRole('button', { name: 'มอบหมายช่าง' }).click();
    await page.getByLabel('ช่าง', { exact: true }).selectOption({ label: FIRST_TECH.name });
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(statusBadge(page, 'มอบหมายแล้ว')).toBeVisible();
  });

  test('first technician hands the ticket over with a reason', async ({ browser }) => {
    const page = await signIn(browser, FIRST_TECH.email);
    await page.goto(ticketUrl);
    await actions(page).getByRole('button', { name: 'ส่งต่อช่างคนอื่น' }).click();
    const picker = page.getByLabel('ช่างคนใหม่');
    await expect(picker.getByRole('option', { name: FIRST_TECH.name })).toHaveCount(0);
    await picker.selectOption({ label: SECOND_TECH.name });
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page.getByText('กรุณากรอกเหตุผล')).toBeVisible();

    await page.getByLabel('เหตุผล', { exact: true }).fill('ติดงานด่วนอีกอาคาร');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page).toHaveURL(/\/tickets$/);
  });

  test('second technician starts and completes the work', async ({ browser }) => {
    const page = await signIn(browser, SECOND_TECH.email);
    await page.goto(ticketUrl);
    await expect(page.getByText('เหตุผล: ติดงานด่วนอีกอาคาร')).toBeVisible();
    await actions(page).getByRole('button', { name: 'เริ่มงาน' }).click();
    await expect(statusBadge(page, 'กำลังดำเนินการ')).toBeVisible();

    await actions(page).getByRole('button', { name: 'เสร็จงาน' }).click();
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page.getByText('กรุณากรอกวิธีแก้ไข')).toBeVisible();
    await expect(statusBadge(page, 'กำลังดำเนินการ')).toBeVisible();

    await page.getByLabel('วิธีแก้ไข').fill('ล้างแผงคอยล์และเติมน้ำยา');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(statusBadge(page, 'แก้ไขเสร็จ')).toBeVisible();
  });

  test('reporter closes the ticket and no actions remain', async ({ browser }) => {
    const page = await signIn(browser, REPORTER);
    await page.goto(ticketUrl);
    await actions(page).getByRole('button', { name: 'ปิดงาน' }).click();
    await expect(statusBadge(page, 'ปิดงาน')).toBeVisible();
    await expect(actions(page)).toHaveCount(0);
  });

  test('the reporter was emailed when the ticket was assigned and done', async () => {
    test.skip(
      process.env.E2E_EMAIL !== '1',
      'set E2E_EMAIL=1 after starting the stack with the Resend mock settings in supabase/functions/.env (see AGENTS.md)',
    );
    for (const status of ['มอบหมายแล้ว', 'แก้ไขเสร็จ']) {
      await expect
        .poll(async () => (await emailsAbout(status)).filter((m) => m.to.includes(REPORTER)), { timeout: 30_000 })
        .toContainEqual(expect.objectContaining({ subject: expect.stringMatching(/^\[แจ้งซ่อม\] /) }));
    }
  });
});

test('a deactivated user cannot sign in until reactivated', async ({ browser }) => {
  const admin = await signIn(browser, ADMIN);
  await admin.getByRole('link', { name: 'ผู้ใช้', exact: true }).click();
  const row = admin.getByRole('row').filter({ hasText: DEACTIVATED });

  const setActive = async (active: boolean) => {
    await row.getByRole('button', { name: active ? 'เปิดใช้งาน' : 'ปิดใช้งาน', exact: true }).click();
    await row.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(row.getByRole('cell', { name: active ? 'ใช้งาน' : 'ปิดใช้งาน', exact: true })).toBeVisible();
  };

  await setActive(false);
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto('/login');
    await page.getByLabel('อีเมล').fill(DEACTIVATED);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    // the seed account must stay usable for the next run and for people using the dev database
    await setActive(true);
  }
  await signIn(browser, DEACTIVATED);
});
