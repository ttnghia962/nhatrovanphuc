import Link from 'next/link';
import { notFound } from 'next/navigation';
import { previousPeriod, formatPeriod } from '@/lib/period';
import { formatWaterDeadline, currentWaterEntryPeriod } from '@/lib/billing/water-deadline';
import { prisma } from '@/server/db';
import { requireRoom } from '@/server/session';
import { submitWaterReading } from '@/server/actions/readings';

export default async function WaterPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomNumber: string }>;
  searchParams: Promise<{ loi?: string }>;
}) {
  const { roomNumber: raw } = await params;
  const roomNumber = Number(raw);
  if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > 32) notFound();

  await requireRoom(roomNumber);
  const { loi } = await searchParams;

  const now = new Date();
  // currentWaterEntryPeriod luôn trả về kỳ CÒN mở tại thời điểm now (trước ngày
  // 10 là tháng trước, từ ngày 10 là tháng này), nên trang này không bao giờ ở
  // trạng thái "quá hạn" — không cần nhánh khoá form. Hạn vẫn được kiểm lại ở
  // server trong submitWaterReading. Kỳ đã trôi qua hạn thì quản lý sửa ở
  // /admin/ky/[year]/[month].
  const period = currentWaterEntryPeriod(now);
  const prev = previousPeriod(period);

  const [previousReading, currentReading] = await Promise.all([
    prisma.meterReading.findUnique({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber,
          meterType: 'WATER',
          year: prev.year,
          month: prev.month,
        },
      },
    }),
    prisma.meterReading.findUnique({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber,
          meterType: 'WATER',
          year: period.year,
          month: period.month,
        },
      },
    }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-4 sm:p-6">
      <Link href={`/phong/${roomNumber}`} className="self-start py-2 text-blue-700">
        ← Xem tiền phòng
      </Link>

      <h1 className="text-xl font-bold">Chỉ số nước {formatPeriod(period)}</h1>

      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <p className="rounded bg-slate-100 p-3">
        Chỉ số {formatPeriod(prev)}:{' '}
        <strong>{previousReading ? previousReading.value : 'chưa có'}</strong>
      </p>

      <p className="rounded bg-blue-50 p-3 text-sm text-blue-900">
        Hạn nhập chỉ số nước {formatPeriod(period)}: <strong>{formatWaterDeadline(period)}</strong>.
        Quá hạn sẽ tự động khóa; khi đó vui lòng báo quản lý để quản lý nhập giúp.
      </p>

      <form action={submitWaterReading} className="flex flex-col gap-3">
        <input type="hidden" name="roomNumber" value={roomNumber} />
        <input type="hidden" name="year" value={period.year} />
        <input type="hidden" name="month" value={period.month} />

        <label htmlFor="value" className="font-medium">
          Chỉ số đồng hồ nước hiện tại
        </label>
        <input
          id="value"
          name="value"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          min={0}
          step={1}
          required
          defaultValue={currentReading?.value ?? ''}
          className="rounded border p-4 text-center text-3xl tabular-nums"
        />

        <button
          type="submit"
          className="rounded-lg bg-blue-600 p-4 text-lg font-medium text-white active:bg-blue-700"
        >
          Lưu chỉ số
        </button>
      </form>
    </main>
  );
}
