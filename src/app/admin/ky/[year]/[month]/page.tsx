import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPeriod, previousPeriod } from '@/lib/period';
import { prisma } from '@/server/db';
import { loadPeriodSummary } from '@/server/billing';
import { savePeriodGrid } from '@/server/actions/period';
import { PeriodOverviewTable } from '@/components/period-overview-table';

export default async function PeriodGridPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ luu?: string; loi?: string }>;
}) {
  const { year: rawYear, month: rawMonth } = await params;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const { luu, loi } = await searchParams;
  const prev = previousPeriod({ year, month });

  const [summary, rooms, readings, lockedRecord] = await Promise.all([
    loadPeriodSummary({ year, month }),
    prisma.room.findMany({
      select: { number: true, defaultTenantName: true },
      orderBy: { number: 'asc' },
    }),
    prisma.meterReading.findMany({
      where: {
        OR: [
          { year, month },
          { year: prev.year, month: prev.month },
        ],
      },
      select: { roomNumber: true, meterType: true, year: true, month: true, value: true },
    }),
    prisma.monthlyRecord.findFirst({
      where: { year, month, locked: true },
      select: { roomNumber: true },
    }),
  ]);

  const locked = lockedRecord !== null;

  function reading(
    roomNumber: number,
    meterType: 'ELECTRIC' | 'WATER',
    y: number,
    m: number,
  ): number | null {
    const hit = readings.find(
      (r) =>
        r.roomNumber === roomNumber &&
        r.meterType === meterType &&
        r.year === y &&
        r.month === m,
    );
    return hit ? hit.value : null;
  }

  // Kỳ rỗng không có dòng nào trong summary, nhưng lưới nhập liệu vẫn phải đủ
  // 32 phòng — mặc định có người ở, đúng như quy ước cũ.
  const gridRows = rooms.map((room) => {
    const row = summary.rows.find((r) => r.roomNumber === room.number);
    return {
      roomNumber: room.number,
      tenantName: row?.tenantName ?? room.defaultTenantName,
      occupied: row ? row.occupied : true,
    };
  });

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold">{formatPeriod({ year, month })}</h1>
        <Link href={`/admin?nam=${year}`} className="underline">
          ← Tổng quan năm {year}
        </Link>
        <a
          href={`/api/export?nam=${year}&thang=${month}`}
          className="ml-auto rounded bg-green-700 px-4 py-2 text-white"
        >
          Tải Excel {formatPeriod({ year, month })}
        </a>
      </header>

      {luu === 'xong' && <p className="rounded bg-green-100 p-3 text-green-900">Đã lưu.</p>}
      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      {locked && (
        <p className="rounded bg-amber-100 p-3 text-amber-900">
          {formatPeriod({ year, month })} đã khoá sổ: số liệu được đóng băng và không sửa được.
          Muốn sửa thì mở khoá ở{' '}
          <Link href={`/admin?nam=${year}`} className="underline">
            trang tổng quan năm {year}
          </Link>
          .
        </p>
      )}

      <h2 className="text-xl font-bold">Bảng tổng quan {formatPeriod({ year, month })}</h2>
      <PeriodOverviewTable summary={summary} />

      <h2 className="text-xl font-bold">Nhập liệu</h2>

      <form action={savePeriodGrid} className="flex flex-col gap-4">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />

        <fieldset disabled={locked} className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2">Phòng</th>
                  <th className="p-2">Họ và tên</th>
                  <th className="p-2">Có người ở</th>
                  <th className="p-2">Điện kỳ trước</th>
                  <th className="p-2">Điện kỳ này</th>
                  <th className="p-2">Nước kỳ trước</th>
                  <th className="p-2">Nước kỳ này</th>
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row) => (
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
                      {reading(row.roomNumber, 'ELECTRIC', prev.year, prev.month) ?? '—'}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        name={`electric_${row.roomNumber}`}
                        defaultValue={reading(row.roomNumber, 'ELECTRIC', year, month) ?? ''}
                        className="w-28 rounded border p-1 text-right"
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums text-slate-500">
                      {reading(row.roomNumber, 'WATER', prev.year, prev.month) ?? '—'}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        name={`water_${row.roomNumber}`}
                        defaultValue={reading(row.roomNumber, 'WATER', year, month) ?? ''}
                        className="w-28 rounded border p-1 text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="submit"
            className="self-start rounded bg-blue-600 px-6 py-3 font-medium text-white disabled:bg-slate-400"
          >
            Lưu toàn bộ
          </button>
        </fieldset>
      </form>

      <p className="text-sm text-slate-500">
        Ô chỉ số để trống nghĩa là xoá chỉ số đó khỏi kỳ này, không phải ghi 0. Quản lý sửa được
        chỉ số nước của mọi kỳ chưa khoá sổ, kể cả khi khách thuê đã quá hạn ngày 10.
      </p>
    </main>
  );
}
