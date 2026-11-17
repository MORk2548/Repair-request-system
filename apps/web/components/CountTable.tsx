type CountRow = { key: string; label: string; count: number; tone?: string };

// A table with a bar beside each count: the numbers stay readable as text (and to screen readers), the bars only
// show the proportions. Status keeps its workflow order; the other tables read best largest first.
export function CountTable({ caption, heading, rows, total, sorted = false }: { caption: string; heading: string; rows: CountRow[]; total: number; sorted?: boolean }) {
  const shown = sorted ? [...rows].sort((a, b) => b.count - a.count) : rows;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="table-wrap">
      <table className="count-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{heading}</th>
            <th scope="col">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>
                <div className="bar-cell">
                  <span className="bar-track" aria-hidden="true">
                    {r.count > 0 && <span className={`bar${r.tone ? ` bar-${r.tone}` : ''}`} style={{ width: `${(r.count / max) * 100}%` }} />}
                  </span>
                  <span className="bar-value">
                    {r.count}
                    {total > 0 && <span className="muted"> ({Math.round((r.count / total) * 100)}%)</span>}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
