import { MONTHS } from '@/lib/period';
import type { MonthlyLine } from '@/server/breakdown';
import { MoneyCell } from './money-cell';

/**
 * Bảng phụ 12 tháng. Trên màn hình rộng giữ đúng dạng ngang như sổ tay
 * (Khoản | T1 … T12 | Cả năm); trên điện thoại 14 cột phải kéo ngang rất khó
 * đọc nên xoay dọc lại: mỗi tháng một dòng, mỗi khoản một cột.
 */
export function YearBreakdownTable({
  lines,
}: {
  /** noTotal: dòng đơn giá — không cộng dồn được nên cột Cả năm để "—" thay vì 0. */
  lines: { label: string; line: MonthlyLine; noTotal?: boolean }[];
}) {
  return (
    <>
      <table className="w-full border-collapse text-sm sm:hidden">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Tháng</th>
            {lines.map(({ label }) => (
              <th key={label} className="p-2 text-right">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((m, index) => (
            <tr key={m} className="border-b">
              <th scope="row" className="p-2 text-left font-normal">
                Tháng {m}
              </th>
              {lines.map(({ label, line }) => (
                <td key={label} className="p-2 text-right">
                  <MoneyCell value={line.months[index]} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <th scope="row" className="p-2 text-left">
              Cả năm
            </th>
            {lines.map(({ label, line, noTotal }) => (
              <td key={label} className="p-2 text-right">
                <MoneyCell value={noTotal ? null : line.total} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-sm lg:text-base lg:[&_td]:py-3 lg:[&_th]:py-3">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-2 text-left">Khoản</th>
              {MONTHS.map((m) => (
                <th key={m} className="p-2 text-right">
                  T{m}
                </th>
              ))}
              <th className="p-2 text-right">Cả năm</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ label, line, noTotal }) => (
              <tr key={label} className="border-b">
                <th scope="row" className="p-2 text-left font-normal">
                  {label}
                </th>
                {line.months.map((value, index) => (
                  <td key={index} className="p-2 text-right">
                    <MoneyCell value={value} />
                  </td>
                ))}
                <td className="p-2 text-right font-semibold">
                  <MoneyCell value={noTotal ? null : line.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
