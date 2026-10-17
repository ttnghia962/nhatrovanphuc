import { previousPeriod, type Period } from '@/lib/period';
import type { PeriodRowInput } from '@/lib/admin/parse-period-grid';
import { loadPeriodSummary, type PeriodSummary } from './billing';
import { prisma } from './db';

export interface PeriodGridRow {
  roomNumber: number;
  tenantName: string;
  occupied: boolean;
  electricPrevious: number | null;
  electricCurrent: number | null;
  waterPrevious: number | null;
  waterCurrent: number | null;
}

/**
 * Dữ liệu của lưới "Nhập liệu" một kỳ: đủ 32 phòng kèm chỉ số kỳ trước / kỳ này.
 * Dùng chung cho trang kỳ và file Excel mẫu, để file mẫu luôn khớp với lưới trên web.
 */
export async function loadPeriodGrid(period: Period): Promise<{
  summary: PeriodSummary;
  locked: boolean;
  rows: PeriodGridRow[];
}> {
  const { year, month } = period;
  const prev = previousPeriod(period);

  const [summary, rooms, readings, lockedRecord] = await Promise.all([
    loadPeriodSummary(period),
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

  function reading(roomNumber: number, meterType: 'ELECTRIC' | 'WATER', p: Period): number | null {
    const hit = readings.find(
      (r) => r.roomNumber === roomNumber && r.meterType === meterType && r.year === p.year && r.month === p.month,
    );
    return hit ? hit.value : null;
  }

  // Kỳ rỗng không có dòng nào trong summary, nhưng lưới nhập liệu vẫn phải đủ
  // 32 phòng — mặc định có người ở, đúng như quy ước cũ.
  const rows = rooms.map((room) => {
    const row = summary.rows.find((r) => r.roomNumber === room.number);
    return {
      roomNumber: room.number,
      tenantName: row?.tenantName ?? room.defaultTenantName,
      occupied: row ? row.occupied : true,
      electricPrevious: reading(room.number, 'ELECTRIC', prev),
      electricCurrent: reading(room.number, 'ELECTRIC', period),
      waterPrevious: reading(room.number, 'WATER', prev),
      waterCurrent: reading(room.number, 'WATER', period),
    };
  });

  return { summary, locked: lockedRecord !== null, rows };
}

export async function isPeriodLocked(period: Period): Promise<boolean> {
  const record = await prisma.monthlyRecord.findFirst({
    where: { year: period.year, month: period.month, locked: true },
    select: { roomNumber: true },
  });
  return record !== null;
}

/**
 * Ghi các dòng nhập liệu của một kỳ trong MỘT transaction: tên, tình trạng ở
 * và chỉ số điện/nước. Chỉ số null nghĩa là xoá chỉ số đó, không phải ghi 0.
 * Phía gọi phải tự kiểm tra kỳ chưa khoá sổ trước khi gọi.
 */
export async function writePeriodRows(period: Period, rows: PeriodRowInput[]): Promise<void> {
  const { year, month } = period;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.monthlyRecord.upsert({
        where: { roomNumber_year_month: { roomNumber: row.roomNumber, year, month } },
        update: { tenantName: row.tenantName, occupied: row.occupied },
        create: {
          roomNumber: row.roomNumber,
          year,
          month,
          tenantName: row.tenantName,
          occupied: row.occupied,
        },
      });

      for (const [meterType, value] of [
        ['ELECTRIC', row.electricReading],
        ['WATER', row.waterReading],
      ] as const) {
        if (value === null) {
          await tx.meterReading.deleteMany({
            where: { roomNumber: row.roomNumber, meterType, year, month },
          });
          continue;
        }

        await tx.meterReading.upsert({
          where: {
            roomNumber_meterType_year_month: { roomNumber: row.roomNumber, meterType, year, month },
          },
          update: { value, enteredBy: 'ADMIN' },
          create: { roomNumber: row.roomNumber, meterType, year, month, value, enteredBy: 'ADMIN' },
        });
      }
    }
  });
}
