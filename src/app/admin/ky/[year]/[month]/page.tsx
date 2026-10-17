import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPeriod } from '@/lib/period';
import { loadPeriodGrid } from '@/server/period-grid';
import { savePeriodGrid } from '@/server/actions/period';
import { PeriodOverviewTable } from '@/components/period-overview-table';
import { PeriodImportForm } from '@/components/period-import-form';

/** Tab con của trang kỳ, nằm trên URL (?tab=) để lưu xong hay bấm Back vẫn đúng tab. */
const TABS = [
  { key: 'tong-quan', label: 'Tổng quan' },
  { key: 'nhap-lieu', label: 'Nhập liệu' },
] as const;

export default async function PeriodGridPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ tab?: string; luu?: string; loi?: string }>;
}) {
  const { year: rawYear, month: rawMonth } = await params;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const { tab: rawTab, luu, loi } = await searchParams;
  const tab = rawTab === 'nhap-lieu' ? 'nhap-lieu' : 'tong-quan';
  const { summary, locked, rows: gridRows } = await loadPeriodGrid({ year, month });
  const base = `/admin/ky/${year}/${month}`;

  return (
    <main className="flex flex-col gap-6 px-4 py-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold">{formatPeriod({ year, month })}</h1>
        <Link href={`/admin?nam=${year}`} className="py-2 underline">
          ← Tổng quan năm {year}
        </Link>
        <a
          href={`/api/export?nam=${year}&thang=${month}`}
          className="rounded bg-green-700 px-4 py-3 text-white sm:ml-auto"
        >
          Tải Excel {formatPeriod({ year, month })}
        </a>
      </header>

      <nav aria-label="Chọn mục" className="-mt-2 flex border-b">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === 'tong-quan' ? base : `${base}?tab=${t.key}`}
              scroll={false}
              aria-current={active ? 'page' : undefined}
              // Không đệm ngang để chữ tab đầu thẳng mép với tiêu đề trang; khoảng cách giữa tab dùng mr-8.
              className={`-mb-px mr-8 border-b-2 py-3 font-medium ${
                active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {locked && (
        <p className="rounded bg-amber-100 p-3 text-amber-900">
          {formatPeriod({ year, month })} đã khoá sổ: số liệu được đóng băng và không sửa được.
          Muốn sửa thì mở khoá ở{' '}
          <Link href={`/admin?nam=${year}`} className="py-2 underline">
            trang tổng quan năm {year}
          </Link>
          .
        </p>
      )}

      {tab === 'tong-quan' ? (
        <>
          <h2 className="text-xl font-bold">Bảng tổng quan {formatPeriod({ year, month })}</h2>
          <PeriodOverviewTable summary={summary} />
        </>
      ) : (
        <>
          {luu === 'xong' && <p className="rounded bg-green-100 p-3 text-green-900">Đã lưu.</p>}
          {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

          <PeriodImportForm year={year} month={month} locked={locked} />

          <form action={savePeriodGrid} className="flex flex-col gap-4">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />

            {/* min-w-0: fieldset mặc định không co hẹp hơn nội dung, khiến bảng rộng đẩy cả
                trang tràn ngang trên điện thoại thay vì cuộn trong khung overflow-x-auto. */}
            <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm lg:text-base lg:[&_td]:py-3 lg:[&_th]:py-3">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="sticky left-0 z-[1] bg-slate-100 p-2">Phòng</th>
                      <th className="p-2 text-left">Họ và tên</th>
                      <th className="p-2 text-center">Có người ở</th>
                      <th className="p-2 text-right">Điện kỳ trước</th>
                      <th className="p-2 text-right">Điện kỳ này</th>
                      <th className="p-2 text-right">Nước kỳ trước</th>
                      <th className="p-2 text-right">Nước kỳ này</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map((row) => (
                      <tr key={row.roomNumber} className="border-b">
                        <td className="sticky left-0 z-[1] bg-white p-2 text-center font-medium">{row.roomNumber}</td>
                        <td className="p-2">
                          <input
                            name={`tenantName_${row.roomNumber}`}
                            defaultValue={row.tenantName}
                            className="w-full min-w-36 rounded border p-1"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            name={`occupied_${row.roomNumber}`}
                            defaultChecked={row.occupied}
                            className="h-5 w-5 align-middle"
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums text-slate-500">
                          {row.electricPrevious ?? '—'}
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            name={`electric_${row.roomNumber}`}
                            defaultValue={row.electricCurrent ?? ''}
                            className="w-28 rounded border p-1 text-right"
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums text-slate-500">
                          {row.waterPrevious ?? '—'}
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            name={`water_${row.roomNumber}`}
                            defaultValue={row.waterCurrent ?? ''}
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
                className="w-full rounded bg-blue-600 px-6 py-3 font-medium text-white disabled:bg-slate-400 sm:w-auto sm:self-start"
              >
                Lưu toàn bộ
              </button>
            </fieldset>
          </form>

          <p className="text-sm text-slate-500">
            Ô chỉ số để trống nghĩa là xoá chỉ số đó khỏi kỳ này, không phải ghi 0. Quản lý sửa được
            chỉ số nước của mọi kỳ chưa khoá sổ, kể cả khi khách thuê đã quá hạn ngày 10.
          </p>
        </>
      )}
    </main>
  );
}
