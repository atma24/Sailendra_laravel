"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onChange: (p: number) => void;
};

const css = `
.pg-wrap { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid #E2E8F0; background: #FFFFFF; flex-wrap: wrap; gap: 10px; }
.pg-info { font-size: 12px; font-weight: 600; color: #64748B; }
.pg-controls { display: flex; align-items: center; gap: 4px; }
.pg-btn { min-width: 32px; height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid #E2E8F0; background: #FFFFFF; color: #334155; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; }
.pg-btn:hover:not(:disabled) { border-color: var(--primary-navy, #191970); color: var(--primary-navy, #191970); background: #EEF2FF; }
.pg-btn.active { background: var(--primary-navy, #191970); color: #FFFFFF; border-color: var(--primary-navy, #191970); font-weight: 800; }
.pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pg-ellipsis { min-width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 12px; font-weight: 800; }
@media (max-width: 640px) {
  .pg-wrap { flex-direction: column; align-items: stretch; text-align: center; }
  .pg-controls { justify-content: center; flex-wrap: wrap; }
}
`;

// Nomor halaman berjendela (maks 5 angka + ellipsis) agar konsisten di semua halaman.
function pageNumbers(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const nums = new Set<number>([1, 2, page - 1, page, page + 1, total - 1, total]);
  const valid = [...nums].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of valid) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

export const PAGE_SIZE = 25;

export function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

export function totalPagesOf(count: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export default function Pagination({ page, totalPages, totalItems, pageSize = PAGE_SIZE, onChange }: Props) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  return (
    <>
      <style>{css}</style>
      <div className="pg-wrap">
        <div className="pg-info">
          Menampilkan {from} - {to} dari {totalItems} data
        </div>
        <div className="pg-controls">
          <button type="button" className="pg-btn" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Halaman sebelumnya">
            <i className="bi bi-chevron-left"></i>
          </button>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="pg-ellipsis">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pg-btn ${page === p ? "active" : ""}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className="pg-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Halaman berikutnya">
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </>
  );
}
