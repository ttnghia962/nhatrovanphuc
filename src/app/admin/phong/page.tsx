import Link from 'next/link';
import { MONTHS } from '@/lib/period';
import { loadRoomsYearOverview } from '@/server/breakdown';
import { MoneyCell } from '@/components/money-cell';

/** Tổng cộng của cả 32 phòng trong một năm: mỗi phòng một dòng, 12 tháng + cả năm. */
export default async function AllRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ nam?: string }>;
}) {
  const { nam } = await searchParams;
  const year = Number(nam) || new Date().getFullYear();

  const overview = await loadRoomsYearOverview(year);
  const roomHref = (roomNumber: number) => `/phong/${roomNumber}?nam=${year}`;

  return (
    <main className="flex flex-col gap-6 px-4 py-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="w-full text-2xl font-bold sm:w-auto">Tổng cộng các phòng năm {year}</h1>
        <Link href={`/admin/phong?nam=${year - 1}`} className="py-2 underline">
          ← {year - 1}
        </Link>
        <Link href={`/admin/phong?nam=${year + 1}`} className="py-2 underline">
          {year + 1} →
        </Link>
      </header>

      {/* Điện thoại: 14 cột không đọc nổi, nên chỉ hiện tổng cả năm của từng
          phòng; chạm vào phòng để xem chi tiết từng tháng. */}
      <ul className="flex flex-col divide-y rounded-lg border sm:hidden">
        {overview.rows.map((row) => (
          <li key={row.roomNumber}>
            <Link href={roomHref(row.roomNumber)} className="flex items-center gap-3 p-3 active:bg-slate-100">
              <span className="text-lg font-semibold">Phòng {row.roomNumber}</span>
              <span className="ml-auto font-semibold">
                <MoneyCell value={row.total.total} />
              </span>
              <span className="text-slate-400">›</span>
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-3 bg-slate-100 p-3 font-bold">
          <span>Cả nhà trọ</span>
          <span className="ml-auto">
            <MoneyCell value={overview.allRooms.total} />
          </span>
        </li>
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse whitespace-nowrap text-sm lg:text-base lg:[&_td]:py-3 lg:[&_th]:py-3">
          <thead>
            <tr className="bg-slate-100">
              <th className="sticky left-0 bg-slate-100 p-2 text-left">Phòng</th>
              {MONTHS.map((m) => (
                <th key={m} className="p-2 text-right">
                  T{m}
                </th>
              ))}
              <th className="p-2 text-right">Cả năm</th>
            </tr>
          </thead>
          <tbody>
            {overview.rows.map((row) => (
              <tr key={row.roomNumber} className="border-b">
                <td className="sticky left-0 bg-white p-2">
                  <Link href={roomHref(row.roomNumber)} className="text-blue-600 underline">
                    {row.roomNumber}
                  </Link>
                </td>
                {row.total.months.map((value, index) => (
                  <td key={index} className="p-2 text-right">
                    <MoneyCell value={value} />
                  </td>
                ))}
                <td className="p-2 text-right font-semibold">
                  <MoneyCell value={row.total.total} />
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td className="sticky left-0 bg-slate-100 p-2">Cả nhà trọ</td>
              {overview.allRooms.months.map((value, index) => (
                <td key={index} className="p-2 text-right">
                  <MoneyCell value={value} />
                </td>
              ))}
              <td className="p-2 text-right">
                <MoneyCell value={overview.allRooms.total} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
