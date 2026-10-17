import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPeriod } from '@/lib/period';
import { loadPeriodSummary } from '@/server/billing';
import { loadRoomYearBreakdown } from '@/server/breakdown';
import { requireRoom } from '@/server/session';
import { RoomSummaryTable } from '@/components/room-summary-table';
import { YearBreakdownTable } from '@/components/year-breakdown-table';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomNumber: string }>;
  searchParams: Promise<{ nam?: string; thang?: string }>;
}) {
  const { roomNumber: raw } = await params;
  const roomNumber = Number(raw);
  if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > 32) notFound();

  await requireRoom(roomNumber);

  const { nam, thang } = await searchParams;
  const now = new Date();
  const year = Number(nam) || now.getFullYear();
  const month = Number(thang) || now.getMonth() + 1;

  const [summary, breakdown] = await Promise.all([
    loadPeriodSummary({ year, month }),
    loadRoomYearBreakdown(roomNumber, year),
  ]);

  // Kỳ rỗng: summary.rows trống. Không 404 — khách thuê chỉ chưa có số liệu.
  const bill = summary.rows.find((r) => r.roomNumber === roomNumber) ?? null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">
          Phòng {roomNumber} — {formatPeriod({ year, month })}
        </h1>
        <Link href={`/phong/${roomNumber}/nuoc`} className="text-blue-600 underline">
          Nhập chỉ số nước
        </Link>
      </header>

      {bill ? (
        <RoomSummaryTable bill={bill} />
      ) : (
        <p className="rounded bg-slate-100 p-4">
          Chưa có số liệu cho {formatPeriod({ year, month })}.
        </p>
      )}

      <h2 className="text-xl font-bold">Chi tiết cả năm {year}</h2>

      <YearBreakdownTable title="Tiền phòng" lines={[{ label: 'Thành tiền', line: breakdown.room }]} />
      <YearBreakdownTable title="Tiền rác" lines={[{ label: 'Thành tiền', line: breakdown.trash }]} />
      <YearBreakdownTable
        title="Tiền điện"
        lines={[
          { label: 'Thành tiền', line: breakdown.electric },
          { label: 'Đơn giá', line: breakdown.electricUnitPrice },
        ]}
      />
      <YearBreakdownTable
        title="Tiền nước"
        lines={[
          { label: 'Thành tiền', line: breakdown.water },
          { label: 'Đơn giá', line: breakdown.waterUnitPrice },
        ]}
      />
      <YearBreakdownTable
        title="Tổng cộng"
        lines={[{ label: 'Tổng', line: breakdown.grandTotal }]}
      />
    </main>
  );
}
