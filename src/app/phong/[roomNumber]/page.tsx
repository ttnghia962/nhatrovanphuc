import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPeriod, nextPeriod, previousPeriod } from '@/lib/period';
import { loadPeriodSummary } from '@/server/billing';
import { loadRoomYearBreakdown, type MonthlyLine } from '@/server/breakdown';
import { requireRoom } from '@/server/session';
import { RoomSummaryTable } from '@/components/room-summary-table';
import { YearBreakdownTable } from '@/components/year-breakdown-table';

const NAV_BUTTON = 'flex h-12 w-12 items-center justify-center rounded-full border text-2xl';

/**
 * Trang của khách thuê. Tab đang xem (?muc=) chọn trên thanh điều hướng ở
 * layout: "tong" (mặc định) là bill của tháng + tổng cả năm; các tab còn lại
 * là bảng 12 tháng của riêng khoản đó.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomNumber: string }>;
  searchParams: Promise<{ nam?: string; thang?: string; muc?: string }>;
}) {
  const { roomNumber: raw } = await params;
  const roomNumber = Number(raw);
  if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > 32) notFound();

  await requireRoom(roomNumber);

  const { nam, thang, muc } = await searchParams;
  const now = new Date();
  const year = Number(nam) || now.getFullYear();
  const rawMonth = Number(thang);
  const month = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : now.getMonth() + 1;

  const [summary, breakdown] = await Promise.all([
    loadPeriodSummary({ year, month }),
    loadRoomYearBreakdown(roomNumber, year),
  ]);

  const sections: Record<
    string,
    { title: string; lines: { label: string; line: MonthlyLine; noTotal?: boolean }[] }
  > = {
    phong: { title: 'Tiền phòng', lines: [{ label: 'Thành tiền', line: breakdown.room }] },
    dien: {
      title: 'Tiền điện',
      lines: [
        { label: 'Công tơ điện', line: breakdown.electricReading, noTotal: true },
        { label: 'Số điện (kWh)', line: breakdown.electricUsage },
        { label: 'Đơn giá', line: breakdown.electricUnitPrice, noTotal: true },
        { label: 'Thành tiền', line: breakdown.electric },
      ],
    },
    nuoc: {
      title: 'Tiền nước',
      lines: [
        { label: 'Thành tiền', line: breakdown.water },
        { label: 'Đơn giá', line: breakdown.waterUnitPrice, noTotal: true },
      ],
    },
    rac: { title: 'Tiền rác', lines: [{ label: 'Thành tiền', line: breakdown.trash }] },
  };
  const tab = muc && muc in sections ? muc : 'tong';

  // Mọi link trong trang giữ nguyên tab đang xem.
  const href = (p: { year: number; month: number }) =>
    `/phong/${roomNumber}?nam=${p.year}&thang=${p.month}${tab === 'tong' ? '' : `&muc=${tab}`}`;

  const waterButton = (
    <Link
      href={`/phong/${roomNumber}/nuoc`}
      className="rounded-lg bg-blue-600 p-4 text-center text-lg font-medium text-white active:bg-blue-700"
    >
      Nhập chỉ số nước
    </Link>
  );

  if (tab !== 'tong') {
    const section = sections[tab];
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:gap-8 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <Link href={href({ year: year - 1, month })} aria-label={`Xem năm ${year - 1}`} className={NAV_BUTTON}>
            ‹
          </Link>
          <h1 className="text-center text-xl font-bold sm:text-2xl">
            {section.title} năm {year}
          </h1>
          <Link href={href({ year: year + 1, month })} aria-label={`Xem năm ${year + 1}`} className={NAV_BUTTON}>
            ›
          </Link>
        </div>

        <YearBreakdownTable lines={section.lines} />

        {tab === 'nuoc' && waterButton}
      </main>
    );
  }

  // Kỳ rỗng: summary.rows trống. Không 404 — khách thuê chỉ chưa có số liệu.
  const bill = summary.rows.find((r) => r.roomNumber === roomNumber) ?? null;
  const prev = previousPeriod({ year, month });
  const next = nextPeriod({ year, month });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:gap-8 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href={href(prev)} aria-label={`Xem ${formatPeriod(prev)}`} className={NAV_BUTTON}>
          ‹
        </Link>
        <h1 className="text-center text-xl font-bold sm:text-2xl">{formatPeriod({ year, month })}</h1>
        <Link href={href(next)} aria-label={`Xem ${formatPeriod(next)}`} className={NAV_BUTTON}>
          ›
        </Link>
      </div>

      {bill ? (
        <RoomSummaryTable bill={bill} />
      ) : (
        <p className="rounded bg-slate-100 p-4">
          Chưa có số liệu cho {formatPeriod({ year, month })}.
        </p>
      )}

      {waterButton}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Tổng cả năm {year}</h2>
        <YearBreakdownTable lines={[{ label: 'Tổng', line: breakdown.grandTotal }]} />
      </section>
    </main>
  );
}
