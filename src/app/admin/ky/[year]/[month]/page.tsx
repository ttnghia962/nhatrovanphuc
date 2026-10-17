import { notFound } from 'next/navigation';
import { formatPeriod, previousPeriod } from '@/lib/period';
import { formatVnd } from '@/lib/money';
import { prisma } from '@/server/db';
import { loadPeriodSummary } from '@/server/billing';
import { savePeriodGrid } from '@/server/actions/period';

export default async function PeriodGridPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ luu?: string }>;
}) {
  const { year: rawYear, month: rawMonth } = await params;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const { luu } = await searchParams;
  const prev = previousPeriod({ year, month });

  const [summary, electricReadings] = await Promise.all([
    loadPeriodSummary({ year, month }),
    prisma.meterReading.findMany({
      where: {
        meterType: 'ELECTRIC',
        OR: [
          { year, month },
          { year: prev.year, month: prev.month },
        ],
      },
    }),
  ]);

  function reading(roomNumber: number, y: number, m: number): number | null {
    const hit = electricReadings.find(
      (r) => r.roomNumber === roomNumber && r.year === y && r.month === m,
    );
    return hit ? hit.value : null;
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Nhập liệu {formatPeriod({ year, month })}</h1>

      {luu === 'xong' && <p className="rounded bg-green-100 p-3 text-green-900">Đã lưu.</p>}

      <form action={savePeriodGrid} className="flex flex-col gap-4">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2">Phòng</th>
                <th className="p-2">Họ và tên</th>
                <th className="p-2">Có người ở</th>
                <th className="p-2">Điện kỳ trước</th>
                <th className="p-2">Điện kỳ này</th>
                <th className="p-2">Nước kỳ này</th>
                <th className="p-2 text-right">Tổng tạm tính</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.roomNumber} className="border-b">
                  <td className="p-2 text-center font-medium">{row.roomNumber}</td>
                  <td className="p-2">
                    <input
                      name={`tenantName_${row.roomNumber}`}
                      defaultValue={row.tenantName}
                      className="w-full rounded border p-1"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      name={`occupied_${row.roomNumber}`}
                      defaultChecked={row.occupied}
                    />
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-500">
                    {reading(row.roomNumber, prev.year, prev.month) ?? '—'}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      name={`electric_${row.roomNumber}`}
                      defaultValue={reading(row.roomNumber, year, month) ?? ''}
                      className="w-28 rounded border p-1 text-right"
                    />
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-500">
                    {row.water.current ?? 'khách chưa nhập'}
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatVnd(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="submit"
          className="self-start rounded bg-blue-600 px-6 py-3 font-medium text-white"
        >
          Lưu toàn bộ
        </button>
      </form>
    </main>
  );
}
