import { describe, it, expect } from 'vitest';
import { buildPeriodSummary, type PeriodData } from './billing';
import type { RateRow } from '@/lib/billing/rates';

const rates: RateRow[] = [
  { feeType: 'ROOM', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 800000 },
  { feeType: 'TRASH', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 20000 },
  { feeType: 'ELECTRIC', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 3500 },
  { feeType: 'WATER', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 7000 },
];

function data(overrides: Partial<PeriodData> = {}): PeriodData {
  return {
    period: { year: 2026, month: 8 },
    rooms: [
      { number: 1, defaultTenantName: 'Huyền' },
      { number: 26, defaultTenantName: '' },
    ],
    records: [
      { roomNumber: 1, tenantName: 'Huyền', occupied: true, locked: false, snapshotJson: null },
      { roomNumber: 26, tenantName: '', occupied: false, locked: false, snapshotJson: null },
    ],
    readings: [
      { roomNumber: 1, meterType: 'ELECTRIC', year: 2026, month: 7, value: 18708 },
      { roomNumber: 1, meterType: 'ELECTRIC', year: 2026, month: 8, value: 18852 },
      { roomNumber: 1, meterType: 'WATER', year: 2026, month: 7, value: 1495 },
      { roomNumber: 1, meterType: 'WATER', year: 2026, month: 8, value: 1500 },
    ],
    rates,
    ...overrides,
  };
}

describe('buildPeriodSummary', () => {
  it('ghép chỉ số kỳ trước làm chỉ số cũ và tính đúng dòng phòng 1', () => {
    const summary = buildPeriodSummary(data());
    const room1 = summary.rows.find((r) => r.roomNumber === 1)!;

    expect(room1.electric.previous).toBe(18708);
    expect(room1.electric.current).toBe(18852);
    expect(room1.total).toBe(1413000);
  });

  it('phòng trống ra 0 đồng', () => {
    const summary = buildPeriodSummary(data());
    const room26 = summary.rows.find((r) => r.roomNumber === 26)!;

    expect(room26.occupied).toBe(false);
    expect(room26.total).toBe(0);
  });

  it('sắp xếp các dòng theo số phòng tăng dần', () => {
    const summary = buildPeriodSummary(data());
    expect(summary.rows.map((r) => r.roomNumber)).toEqual([1, 26]);
  });

  it('cộng dòng tổng cuối bảng', () => {
    const summary = buildPeriodSummary(data());

    expect(summary.totals.roomFee).toBe(800000);
    expect(summary.totals.electricFee).toBe(504000);
    expect(summary.totals.waterFee).toBe(35000);
    expect(summary.totals.lossFee).toBe(53900);
    expect(summary.totals.total).toBe(1413000);
  });

  it('phòng chưa có MonthlyRecord thì mặc định là có người ở và lấy tên mặc định', () => {
    const summary = buildPeriodSummary(data({ records: [] }));
    const room1 = summary.rows.find((r) => r.roomNumber === 1)!;

    expect(room1.occupied).toBe(true);
    expect(room1.tenantName).toBe('Huyền');
  });

  it('kỳ đã khoá thì dùng số liệu trong snapshot thay vì tính lại', () => {
    const frozen = {
      roomNumber: 1,
      tenantName: 'Huyền',
      occupied: true,
      roomFee: 700000,
      trashFee: 20000,
      electric: { previous: 18708, current: 18852, usage: 144, unitPrice: 3000, amount: 432000 },
      water: { previous: 1495, current: 1500, usage: 5, unitPrice: 7000, amount: 35000 },
      lossFee: 46700,
      total: 1202000,
      issues: [],
    };

    const summary = buildPeriodSummary(
      data({
        records: [
          {
            roomNumber: 1,
            tenantName: 'Huyền',
            occupied: true,
            locked: true,
            snapshotJson: JSON.stringify(frozen),
          },
          { roomNumber: 26, tenantName: '', occupied: false, locked: false, snapshotJson: null },
        ],
      }),
    );

    expect(summary.rows.find((r) => r.roomNumber === 1)!.total).toBe(1202000);
  });
});
