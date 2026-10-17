import Link from 'next/link';
import { MONTHS } from '@/lib/period';
import { formatVnd } from '@/lib/money';
import { loadYearDashboard } from '@/server/dashboard';
import { lockPeriod } from '@/server/actions/lock';
import { prisma } from '@/server/db';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ nam?: string }>;
}) {
  const { nam } = await searchParams;
  const year = Number(nam) || new Date().getFullYear();

  const [dashboard, lockedRecords] = await Promise.all([
    loadYearDashboard(year),
    prisma.monthlyRecord.findMany({
      where: { year, locked: true },
      select: { month: true },
      distinct: ['month'],
    }),
  ]);

  const lockedMonths = new Set(lockedRecords.map((r) => r.month));
  const maxTotal = Math.max(1, ...dashboard.monthlyTotals.map((t) => t.total));

  return (
    <main className="flex flex-col gap-6 px-4 py-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="w-full text-2xl font-bold sm:w-auto">Tổng quan năm {year}</h1>
        <Link href={`/admin?nam=${year - 1}`} className="py-2 underline">
          ← {year - 1}
        </Link>
        <Link href={`/admin?nam=${year + 1}`} className="py-2 underline">
          {year + 1} →
        </Link>
        <a
          href={`/api/export?nam=${year}`}
          className="ml-auto rounded bg-green-700 px-4 py-3 text-white"
        >
          Tải Excel
        </a>
      </header>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Doanh thu theo tháng</h2>
        <div className="flex h-48 items-end gap-1 sm:gap-2">
          {dashboard.monthlyTotals.map((totals, index) => (
            <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-blue-500"
                  style={{ height: `${(totals.total / maxTotal) * 100}%` }}
                  title={formatVnd(totals.total)}
                />
              </div>
              <span className="text-xs">T{index + 1}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full border-collapse whitespace-nowrap text-sm lg:text-base lg:[&_td]:py-3 lg:[&_th]:py-3">
        <thead>
          <tr className="bg-slate-100">
            <th className="sticky left-0 bg-slate-100 p-2 text-left">Tháng</th>
            <th className="p-2 text-right">Tiền phòng</th>
            <th className="p-2 text-right">Tiền rác</th>
            <th className="p-2 text-right">Tiền điện</th>
            <th className="p-2 text-right">Tiền nước</th>
            <th className="p-2 text-right">Hao hụt</th>
            <th className="p-2 text-right">Tổng</th>
            <th className="p-2 text-center">Phòng có người</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((month) => {
            const totals = dashboard.monthlyTotals[month - 1];
            const locked = lockedMonths.has(month);

            return (
              <tr key={month} className="border-b">
                <td className="sticky left-0 bg-white p-2">
                  <Link href={`/admin/ky/${year}/${month}`} className="inline-block py-1 text-blue-600 underline">
                    Tháng {month}
                  </Link>
                </td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.roomFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.trashFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.electricFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.waterFee)}</td>
                <td className="p-2 text-right tabular-nums">{formatVnd(totals.lossFee)}</td>
                <td className="p-2 text-right font-semibold tabular-nums">
                  {formatVnd(totals.total)}
                </td>
                <td className="p-2 text-center">{dashboard.occupiedCountByMonth[month - 1]}</td>
                <td className="p-2 text-right">
                  <form action={lockPeriod}>
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="month" value={month} />
                    <input type="hidden" name="action" value={locked ? 'unlock' : 'lock'} />
                    <button type="submit" className="px-1 py-1 underline">
                      {locked ? 'Mở khoá' : 'Khoá sổ'}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
          <tr className="bg-slate-100 font-bold">
            <td className="sticky left-0 bg-slate-100 p-2">Cả năm</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.roomFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.trashFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.electricFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.waterFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.lossFee)}</td>
            <td className="p-2 text-right tabular-nums">{formatVnd(dashboard.yearTotals.total)}</td>
            <td className="p-2" />
            <td className="p-2" />
          </tr>
        </tbody>
      </table>
      </div>
    </main>
  );
}
