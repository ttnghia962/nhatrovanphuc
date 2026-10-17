import ExcelJS from 'exceljs';
import { MONTHS, formatPeriod } from '@/lib/period';
import { loadPeriodSummary, type PeriodSummary } from './billing';
import { buildRoomYearBreakdown, type MonthlyLine, type RoomYearBreakdown } from './breakdown';

const SUMMARY_HEADERS = [
  'Số phòng',
  'Họ và tên',
  'Tiền phòng',
  'Tiền rác',
  'Điện cũ',
  'Điện mới',
  'Điện TSD',
  'Điện thành tiền',
  'Nước cũ',
  'Nước mới',
  'Nước TSD',
  'Nước thành tiền',
  'Tổng (gồm hao hụt 10%)',
];

function addPivotSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  breakdowns: RoomYearBreakdown[],
  pick: (b: RoomYearBreakdown) => MonthlyLine,
) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(['Số phòng', ...MONTHS.map((m) => `Tháng ${m}`), 'Cả năm']);
  sheet.getRow(1).font = { bold: true };

  for (const breakdown of breakdowns) {
    const line = pick(breakdown);
    sheet.addRow([breakdown.roomNumber, ...line.months, line.total]);
  }

  sheet.columns.forEach((column) => {
    column.width = 14;
  });
}

export function buildWorkbook(input: {
  year: number;
  month: number;
  summary: PeriodSummary;
  breakdowns: RoomYearBreakdown[];
}): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Tong quan');
  summarySheet.addRow([formatPeriod({ year: input.year, month: input.month })]);
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.addRow(SUMMARY_HEADERS);
  summarySheet.getRow(2).font = { bold: true };

  for (const row of input.summary.rows) {
    summarySheet.addRow([
      row.roomNumber,
      row.tenantName,
      row.roomFee,
      row.trashFee,
      row.electric.previous,
      row.electric.current,
      row.electric.usage,
      row.electric.amount,
      row.water.previous,
      row.water.current,
      row.water.usage,
      row.water.amount,
      row.total,
    ]);
  }

  const totalsRow = summarySheet.addRow([
    'TỔNG CỘNG',
    '',
    input.summary.totals.roomFee,
    input.summary.totals.trashFee,
    null,
    null,
    null,
    input.summary.totals.electricFee,
    null,
    null,
    null,
    input.summary.totals.waterFee,
    input.summary.totals.total,
  ]);
  totalsRow.font = { bold: true };

  summarySheet.columns.forEach((column) => {
    column.width = 16;
  });

  addPivotSheet(workbook, 'Phong', input.breakdowns, (b) => b.room);
  addPivotSheet(workbook, 'Dien', input.breakdowns, (b) => b.electric);
  addPivotSheet(workbook, 'Nuoc', input.breakdowns, (b) => b.water);
  addPivotSheet(workbook, 'Rac', input.breakdowns, (b) => b.trash);

  return workbook;
}

export async function exportYearWorkbook(year: number, month: number): Promise<Buffer> {
  // MONTHS = [1..12], nên summaries[month - 1] đúng là kỳ được yêu cầu.
  // Nạp 12 bảng tổng quan MỘT LẦN, rồi dựng 32 bảng breakdown từ dữ liệu
  // đã có bằng hàm thuần buildRoomYearBreakdown, tránh N+1 (32 * loadRoomYearBreakdown
  // sẽ load lại 12 kỳ cho mỗi phòng, tức 384 lượt load thay vì 12).
  const summaries = await Promise.all(
    MONTHS.map((m) => loadPeriodSummary({ year, month: m })),
  );
  const summary = summaries[month - 1];
  const breakdowns = summary.rows.map((row) =>
    buildRoomYearBreakdown(row.roomNumber, year, summaries),
  );

  const workbook = buildWorkbook({ year, month, summary, breakdowns });
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
