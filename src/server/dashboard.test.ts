import { describe, it, expect } from 'vitest';
import { buildYearDashboard } from './dashboard';
import type { PeriodSummary } from './billing';
import type { RoomBill } from '@/lib/billing/calculate';

function bill(roomNumber: number, occupied: boolean, total: number): RoomBill {
  return {
    roomNumber,
    tenantName: '',
    occupied,
    roomFee: occupied ? 800000 : 0,
    trashFee: occupied ? 20000 : 0,
    electric: { previous: null, current: null, usage: null, unitPrice: 3500, amount: 0 },
    water: { previous: null, current: null, usage: null, unitPrice: 7000, amount: 0 },
    lossFee: 0,
    total,
    issues: [],
  };
}

function summary(month: number, rows: RoomBill[]): PeriodSummary {
  return {
    period: { year: 2026, month },
    rows,
    totals: {
      roomFee: rows.reduce((s, r) => s + r.roomFee, 0),
      trashFee: rows.reduce((s, r) => s + r.trashFee, 0),
      electricFee: 0,
      waterFee: 0,
      lossFee: 0,
      total: rows.reduce((s, r) => s + r.total, 0),
    },
    hasData: true,
  };
}

describe('buildYearDashboard', () => {
  it('trả về đúng 12 phần tử cho các tháng', () => {
    const dashboard = buildYearDashboard(2026, []);
    expect(dashboard.monthlyTotals).toHaveLength(12);
    expect(dashboard.occupiedCountByMonth).toHaveLength(12);
  });

  it('tháng chưa có dữ liệu thì mọi khoản bằng 0', () => {
    const dashboard = buildYearDashboard(2026, []);
    expect(dashboard.monthlyTotals[0].total).toBe(0);
    expect(dashboard.occupiedCountByMonth[0]).toBe(0);
  });

  it('đếm số phòng có người ở của từng tháng', () => {
    const dashboard = buildYearDashboard(2026, [
      summary(8, [bill(1, true, 820000), bill(26, false, 0)]),
    ]);

    expect(dashboard.occupiedCountByMonth[7]).toBe(1);
  });

  it('cộng tổng cả năm từ các tháng có dữ liệu', () => {
    const dashboard = buildYearDashboard(2026, [
      summary(7, [bill(1, true, 820000)]),
      summary(8, [bill(1, true, 820000)]),
    ]);

    expect(dashboard.yearTotals.total).toBe(1640000);
    expect(dashboard.yearTotals.roomFee).toBe(1600000);
  });

  it('bỏ qua kỳ thuộc năm khác', () => {
    const other: PeriodSummary = {
      ...summary(8, [bill(1, true, 820000)]),
      period: { year: 2025, month: 8 },
    };

    const dashboard = buildYearDashboard(2026, [other]);
    expect(dashboard.yearTotals.total).toBe(0);
  });

  it('kỳ rỗng (hasData=false) không cộng vào tổng năm dù totals có số', () => {
    const empty: PeriodSummary = {
      ...summary(8, [bill(1, true, 820000)]),
      hasData: false,
    };

    const dashboard = buildYearDashboard(2026, [empty]);
    expect(dashboard.yearTotals.total).toBe(0);
    expect(dashboard.monthlyTotals[7].total).toBe(0);
    expect(dashboard.occupiedCountByMonth[7]).toBe(0);
  });
});
