import { describe, it, expect } from 'vitest';
import { buildWorkbook } from './excel';
import type { PeriodSummary } from './billing';
import type { RoomYearBreakdown } from './breakdown';
import type { RoomBill } from '@/lib/billing/calculate';

const row: RoomBill = {
  roomNumber: 1,
  tenantName: 'Huyền',
  occupied: true,
  roomFee: 800000,
  trashFee: 20000,
  electric: { previous: 18708, current: 18852, usage: 144, unitPrice: 3500, amount: 504000 },
  water: { previous: 1495, current: 1500, usage: 5, unitPrice: 7000, amount: 35000 },
  lossFee: 53900,
  total: 1413000,
  issues: [],
};

const summary: PeriodSummary = {
  period: { year: 2026, month: 8 },
  rows: [row],
  totals: {
    roomFee: 800000,
    trashFee: 20000,
    electricFee: 504000,
    waterFee: 35000,
    lossFee: 53900,
    total: 1413000,
  },
};

function emptyLine() {
  return { months: Array.from({ length: 12 }, () => null), total: 0 };
}

const breakdown: RoomYearBreakdown = {
  roomNumber: 1,
  year: 2026,
  room: { months: [...emptyLine().months], total: 800000 },
  trash: emptyLine(),
  electric: emptyLine(),
  electricUnitPrice: emptyLine(),
  water: emptyLine(),
  waterUnitPrice: emptyLine(),
  grandTotal: emptyLine(),
};

describe('buildWorkbook', () => {
  it('tạo đủ 5 sheet', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });

    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tong quan',
      'Phong',
      'Dien',
      'Nuoc',
      'Rac',
    ]);
  });

  it('sheet Tong quan có dòng tiêu đề tiếng Việt', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Tong quan')!;

    expect(sheet.getRow(2).getCell(1).value).toBe('Số phòng');
    expect(sheet.getRow(2).getCell(2).value).toBe('Họ và tên');
  });

  it('ghi đúng số liệu dòng phòng 1', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Tong quan')!;
    const dataRow = sheet.getRow(3);

    expect(dataRow.getCell(1).value).toBe(1);
    expect(dataRow.getCell(2).value).toBe('Huyền');
    expect(dataRow.getCell(13).value).toBe(1413000);
  });

  it('có dòng tổng cộng ở cuối sheet Tong quan', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Tong quan')!;

    expect(sheet.getRow(4).getCell(1).value).toBe('TỔNG CỘNG');
    expect(sheet.getRow(4).getCell(13).value).toBe(1413000);
  });

  it('sheet Phong có một dòng cho mỗi phòng', () => {
    const wb = buildWorkbook({ year: 2026, month: 8, summary, breakdowns: [breakdown] });
    const sheet = wb.getWorksheet('Phong')!;

    expect(sheet.getRow(2).getCell(1).value).toBe(1);
    expect(sheet.getRow(2).getCell(14).value).toBe(800000);
  });
});
