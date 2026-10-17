import { MONTHS } from '@/lib/period';
import type { MonthlyLine } from '@/server/breakdown';
import { MoneyCell } from './money-cell';

export function YearBreakdownTable({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; line: MonthlyLine }[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
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
            {lines.map(({ label, line }) => (
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
                  <MoneyCell value={line.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
