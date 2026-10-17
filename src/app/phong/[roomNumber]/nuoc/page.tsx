import { notFound } from 'next/navigation';
import { previousPeriod, formatPeriod } from '@/lib/period';
import {
  formatWaterDeadline,
  isWaterEntryOpen,
  currentWaterEntryPeriod,
} from '@/lib/billing/water-deadline';
import { prisma } from '@/server/db';
import { getSession, requireRoom } from '@/server/session';
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
  const session = await getSession();

  const now = new Date();
  const period = currentWaterEntryPeriod(now);
  const prev = previousPeriod(period);

  const open = isWaterEntryOpen(period, now);
  // Admin vẫn sửa được sau hạn; chỉ khách thuê bị chặn.
  const canSubmit = open || session?.role === 'admin';

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
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">
        Phòng {roomNumber} — chỉ số nước {formatPeriod(period)}
      </h1>

      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <p className="rounded bg-slate-100 p-3">
        Chỉ số {formatPeriod(prev)}:{' '}
        <strong>{previousReading ? previousReading.value : 'chưa có'}</strong>
      </p>

      {open ? (
        <p className="rounded bg-blue-50 p-3 text-sm text-blue-900">
          Hạn nhập chỉ số nước {formatPeriod(period)}: <strong>{formatWaterDeadline(period)}</strong>.
          Quá hạn sẽ tự động khóa.
        </p>
      ) : (
        <p className="rounded bg-amber-100 p-3 text-sm text-amber-900">
          Đã quá hạn nhập chỉ số nước {formatPeriod(period)} ({formatWaterDeadline(period)}).
          {session?.role === 'admin'
            ? ' Bạn đang đăng nhập bằng quyền quản lý nên vẫn sửa được.'
            : ' Vui lòng báo quản lý nếu cần chỉnh sửa.'}
        </p>
      )}

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
          min={0}
          step={1}
          required
          disabled={!canSubmit}
          defaultValue={currentReading?.value ?? ''}
          className="rounded border p-3 text-lg disabled:bg-slate-100 disabled:text-slate-400"
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-blue-600 p-3 font-medium text-white disabled:bg-slate-400"
        >
          {canSubmit ? 'Lưu chỉ số' : 'Đã khóa'}
        </button>
      </form>
    </main>
  );
}
