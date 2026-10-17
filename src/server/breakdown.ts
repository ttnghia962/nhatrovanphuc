import { MONTHS } from '@/lib/period';
import { loadPeriodSummary, type PeriodSummary } from './billing';
import { prisma } from './db';

export interface MonthlyLine {
  /** 12 phần tử, chỉ số 0 là tháng 1. null = chưa có dữ liệu tháng đó. */
  months: (number | null)[];
  total: number;
}

export interface RoomYearBreakdown {
  roomNumber: number;
  year: number;
  room: MonthlyLine;
  trash: MonthlyLine;
  electric: MonthlyLine;
  electricUnitPrice: MonthlyLine;
  water: MonthlyLine;
  waterUnitPrice: MonthlyLine;
  grandTotal: MonthlyLine;
}

function emptyLine(): MonthlyLine {
  return { months: Array.from({ length: 12 }, () => null), total: 0 };
}

function put(line: MonthlyLine, month: number, value: number | null, countInTotal: boolean) {
  line.months[month - 1] = value;
  if (countInTotal && value !== null) line.total += value;
}

export function buildRoomYearBreakdown(
  roomNumber: number,
  year: number,
  summaries: PeriodSummary[],
): RoomYearBreakdown {
  const result: RoomYearBreakdown = {
    roomNumber,
    year,
    room: emptyLine(),
    trash: emptyLine(),
    electric: emptyLine(),
    electricUnitPrice: emptyLine(),
    water: emptyLine(),
    waterUnitPrice: emptyLine(),
    grandTotal: emptyLine(),
  };

  for (const month of MONTHS) {
    const summary = summaries.find(
      (s) => s.period.year === year && s.period.month === month,
    );
    // Kỳ rỗng để nguyên null cho cả 12 ô -> MoneyCell hiển thị gạch ngang.
    if (!summary || !summary.hasData) continue;

    const row = summary.rows.find((r) => r.roomNumber === roomNumber);
    if (!row) continue;

    put(result.room, month, row.roomFee, true);
    put(result.trash, month, row.trashFee, true);
    put(result.electric, month, row.electric.amount, true);
    put(result.water, month, row.water.amount, true);
    put(result.grandTotal, month, row.total, true);
    // Đơn giá không phải tiền tích luỹ nên không cộng vào tổng năm.
    put(result.electricUnitPrice, month, row.electric.unitPrice, false);
    put(result.waterUnitPrice, month, row.water.unitPrice, false);
  }

  return result;
}

export interface RoomsYearOverview {
  year: number;
  rows: { roomNumber: number; total: MonthlyLine }[];
  /** Cộng cả nhà trọ theo từng tháng; tháng chưa có phòng nào có dữ liệu là null. */
  allRooms: MonthlyLine;
}

/** Bảng Tổng cộng của cả 32 phòng trong một năm: mỗi phòng một dòng 12 tháng. */
export function buildRoomsYearOverview(
  year: number,
  roomNumbers: number[],
  summaries: PeriodSummary[],
): RoomsYearOverview {
  const allRooms = emptyLine();

  const rows = roomNumbers.map((roomNumber) => {
    const breakdown = buildRoomYearBreakdown(roomNumber, year, summaries);

    breakdown.grandTotal.months.forEach((value, index) => {
      if (value === null) return;
      allRooms.months[index] = (allRooms.months[index] ?? 0) + value;
      allRooms.total += value;
    });

    return { roomNumber, total: breakdown.grandTotal };
  });

  return { year, rows, allRooms };
}

export async function loadRoomYearBreakdown(
  roomNumber: number,
  year: number,
): Promise<RoomYearBreakdown> {
  const summaries = await Promise.all(
    MONTHS.map((month) => loadPeriodSummary({ year, month })),
  );
  return buildRoomYearBreakdown(roomNumber, year, summaries);
}

export async function loadRoomsYearOverview(year: number): Promise<RoomsYearOverview> {
  const [rooms, summaries] = await Promise.all([
    prisma.room.findMany({ select: { number: true }, orderBy: { number: 'asc' } }),
    Promise.all(MONTHS.map((month) => loadPeriodSummary({ year, month }))),
  ]);
  return buildRoomsYearOverview(
    year,
    rooms.map((r) => r.number),
    summaries,
  );
}
