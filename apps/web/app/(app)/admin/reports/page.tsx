import { getTicketSummary } from '@repair/api';
import { STATUS_LABELS, bangkokMonthRange, dateRangeSchema } from '@repair/core';
import { getSession } from '../../../../lib/session';

type Search = { from?: string; to?: string };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { from, to } = await searchParams;
  const { db } = await getSession();

  const asked = from !== undefined || to !== undefined ? dateRangeSchema.safeParse({ from, to }) : null;
  const rangeError = asked && !asked.success ? asked.error.issues[0]?.message : undefined;
  const range = asked?.success ? asked.data : bangkokMonthRange(new Date());
  const summary = await getTicketSummary(db, range);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="eyebrow">ผู้ดูแลระบบ</div>
        <h1>รายงาน</h1>
        <p>นับใบแจ้งซ่อมตามวันที่แจ้ง (เวลาไทย) รวมวันแรกและวันสุดท้าย</p>
      </header>
      <form method="get" className="panel">
        <div className="row">
          <div className="field">
            <label htmlFor="from">ตั้งแต่วันที่</label>
            <input id="from" name="from" type="date" defaultValue={range.from} required />
          </div>
          <div className="field">
            <label htmlFor="to">ถึงวันที่</label>
            <input id="to" name="to" type="date" defaultValue={range.to} required />
          </div>
        </div>
        {rangeError && (
          <p role="alert" className="alert alert-error">
            {rangeError} แสดงเดือนปัจจุบันแทน
          </p>
        )}
        <div className="actions">
          <button type="submit" className="button">
            แสดงรายงาน
          </button>
        </div>
      </form>

      {summary.total === 0 && <p className="panel empty">ไม่มีใบแจ้งซ่อมในช่วงนี้</p>}

      <dl className="detail-grid summary">
        <div>
          <dt>จำนวนใบแจ้งซ่อมทั้งหมด</dt>
          <dd>{summary.total}</dd>
        </div>
        <div>
          <dt>เวลาเฉลี่ยจากแจ้งถึงแก้เสร็จ</dt>
          <dd>{summary.avgResolveHours === null ? '-' : `${summary.avgResolveHours} ชั่วโมง`}</dd>
        </div>
      </dl>

      <CountTable
        caption="ตามสถานะ"
        heading="สถานะ"
        rows={summary.byStatus.map((s) => ({ key: s.status, label: STATUS_LABELS[s.status], count: s.count }))}
      />
      <CountTable
        caption="ตามหมวด"
        heading="หมวด"
        rows={summary.byCategory.map((c) => ({ key: String(c.categoryId), label: c.name, count: c.count }))}
      />
      <CountTable
        caption="ตามช่าง"
        heading="ช่าง"
        rows={summary.byAssignee.map((a) => ({ key: a.assigneeId ?? 'none', label: a.name ?? 'ยังไม่มอบหมาย', count: a.count }))}
      />
    </div>
  );
}

function CountTable({ caption, heading, rows }: { caption: string; heading: string; rows: { key: string; label: string; count: number }[] }) {
  return (
    <div className="table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{heading}</th>
            <th scope="col">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
