import { previousPeriod, type Period } from '@/lib/period';
import { pickRate, type RateRow } from '@/lib/billing/rates';
import { calculateRoomBill, type RoomBill } from '@/lib/billing/calculate';
import { prisma } from './db';

export interface PeriodData {
  period: Period;
  rooms: { number: number; defaultTenantName: string }[];
  records: {
    roomNumber: number;
    tenantName: string;
    occupied: boolean;
    locked: boolean;
    snapshotJson: string | null;
  }[];
  readings: {
    roomNumber: number;
    meterType: 'ELECTRIC' | 'WATER';
    year: number;
    month: number;
    value: number;
  }[];
  rates: RateRow[];
}

export interface PeriodTotals {
  roomFee: number;
  trashFee: number;
  electricFee: number;
  waterFee: number;
  lossFee: number;
  total: number;
}

export interface PeriodSummary {
  period: Period;
  rows: RoomBill[];
  totals: PeriodTotals;
  /**
   * false khi kỳ này chưa hề được chạm tới: không có MonthlyRecord nào và
   * cũng không có MeterReading nào của chính kỳ đó. Kỳ rỗng không được sinh
   * ra doanh thu: `rows` để trống và `totals` bằng 0, để các tầng trên
   * (dashboard, bảng chi tiết năm) hiển thị gạch ngang thay vì số tiền bịa.
   */
  hasData: boolean;
}

export function zeroTotals(): PeriodTotals {
  return { roomFee: 0, trashFee: 0, electricFee: 0, waterFee: 0, lossFee: 0, total: 0 };
}

/**
 * Hàm thuần: kỳ này đã có dữ liệu chưa?
 * Chỉ tính MeterReading của ĐÚNG kỳ đang xét — `data.readings` còn chứa chỉ số
 * kỳ trước (dùng làm "số cũ"), nếu đếm cả thì tháng 9 rỗng sẽ bị coi là có dữ liệu
 * chỉ vì tháng 8 có.
 */
export function periodHasData(data: PeriodData): boolean {
  if (data.records.length > 0) return true;
  return data.readings.some(
    (r) => r.year === data.period.year && r.month === data.period.month,
  );
}

function readingValue(
  readings: PeriodData['readings'],
  roomNumber: number,
  meterType: 'ELECTRIC' | 'WATER',
  period: Period,
): number | null {
  const hit = readings.find(
    (r) =>
      r.roomNumber === roomNumber &&
      r.meterType === meterType &&
      r.year === period.year &&
      r.month === period.month,
  );
  return hit ? hit.value : null;
}

/** Hàm thuần: nhận dữ liệu đã nạp sẵn, trả bảng TỔNG QUAN của kỳ. */
export function buildPeriodSummary(data: PeriodData): PeriodSummary {
  if (!periodHasData(data)) {
    return { period: data.period, rows: [], totals: zeroTotals(), hasData: false };
  }

  const prev = previousPeriod(data.period);

  const rows: RoomBill[] = data.rooms
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((room) => {
      const record = data.records.find((r) => r.roomNumber === room.number);

      if (record?.locked && record.snapshotJson) {
        return JSON.parse(record.snapshotJson) as RoomBill;
      }

      return calculateRoomBill({
        roomNumber: room.number,
        tenantName: record?.tenantName || room.defaultTenantName,
        occupied: record ? record.occupied : true,
        roomPrice: pickRate(data.rates, 'ROOM', room.number, data.period),
        trashPrice: pickRate(data.rates, 'TRASH', room.number, data.period),
        electric: {
          previous: readingValue(data.readings, room.number, 'ELECTRIC', prev),
          current: readingValue(data.readings, room.number, 'ELECTRIC', data.period),
          unitPrice: pickRate(data.rates, 'ELECTRIC', room.number, data.period),
        },
        water: {
          previous: readingValue(data.readings, room.number, 'WATER', prev),
          current: readingValue(data.readings, room.number, 'WATER', data.period),
          unitPrice: pickRate(data.rates, 'WATER', room.number, data.period),
        },
      });
    });

  const totals = rows.reduce<PeriodTotals>(
    (acc, row) => ({
      roomFee: acc.roomFee + row.roomFee,
      trashFee: acc.trashFee + row.trashFee,
      electricFee: acc.electricFee + row.electric.amount,
      waterFee: acc.waterFee + row.water.amount,
      lossFee: acc.lossFee + row.lossFee,
      total: acc.total + row.total,
    }),
    zeroTotals(),
  );

  return { period: data.period, rows, totals, hasData: true };
}

/** Nạp dữ liệu từ DB cho một kỳ rồi dựng bảng TỔNG QUAN. */
export async function loadPeriodSummary(period: Period): Promise<PeriodSummary> {
  const prev = previousPeriod(period);

  const [rooms, records, readings, rates] = await Promise.all([
    prisma.room.findMany({ select: { number: true, defaultTenantName: true } }),
    prisma.monthlyRecord.findMany({
      where: { year: period.year, month: period.month },
      select: {
        roomNumber: true,
        tenantName: true,
        occupied: true,
        locked: true,
        snapshotJson: true,
      },
    }),
    prisma.meterReading.findMany({
      where: {
        OR: [
          { year: period.year, month: period.month },
          { year: prev.year, month: prev.month },
        ],
      },
      select: { roomNumber: true, meterType: true, year: true, month: true, value: true },
    }),
    prisma.rate.findMany({
      select: {
        feeType: true,
        roomNumber: true,
        effectiveYear: true,
        effectiveMonth: true,
        unitPrice: true,
      },
    }),
  ]);

  return buildPeriodSummary({
    period,
    rooms,
    records,
    readings: readings as PeriodData['readings'],
    rates: rates as RateRow[],
  });
}
