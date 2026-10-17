import { describe, it, expect } from 'vitest';
import { buildRoomYearBreakdown } from './breakdown';
import type { PeriodSummary } from './billing';
import type { RoomBill } from '@/lib/billing/calculate';

function bill(overrides: Partial<RoomBill> = {}): RoomBill {
  return {
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
    ...overrides,
  };
}

function summary(month: number, row: RoomBill): PeriodSummary {
  return {
    period: { year: 2026, month },
    rows: [row],
    totals: {
      roomFee: row.roomFee,
      trashFee: row.trashFee,
      electricFee: row.electric.amount,
      waterFee: row.water.amount,
      lossFee: row.lossFee,
      total: row.total,
    },
  };
}

describe('buildRoomYearBreakdown', () => {
  it('đặt số liệu đúng vị trí tháng và để null cho tháng thiếu', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(8, bill())]);

    expect(result.room.months[7]).toBe(800000);
    expect(result.room.months[0]).toBeNull();
    expect(result.room.months).toHaveLength(12);
  });

  it('cộng tổng năm bỏ qua tháng thiếu', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(7, bill()), summary(8, bill())]);

    expect(result.room.total).toBe(1600000);
    expect(result.electric.total).toBe(1008000);
    expect(result.grandTotal.total).toBe(2826000);
  });

  it('ghi lại đơn giá điện và nước của từng tháng', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(8, bill())]);

    expect(result.electricUnitPrice.months[7]).toBe(3500);
    expect(result.waterUnitPrice.months[7]).toBe(7000);
  });

  it('bỏ qua các dòng của phòng khác', () => {
    const other = summary(8, bill({ roomNumber: 2 }));
    const result = buildRoomYearBreakdown(1, 2026, [other]);

    expect(result.room.months[7]).toBeNull();
    expect(result.room.total).toBe(0);
  });

  it('tháng phòng trống ghi 0 chứ không phải null', () => {
    const vacant = bill({
      occupied: false,
      roomFee: 0,
      trashFee: 0,
      electric: { previous: null, current: null, usage: null, unitPrice: null, amount: 0 },
      water: { previous: null, current: null, usage: null, unitPrice: null, amount: 0 },
      lossFee: 0,
      total: 0,
    });
    const result = buildRoomYearBreakdown(1, 2026, [summary(8, vacant)]);

    expect(result.room.months[7]).toBe(0);
    expect(result.grandTotal.months[7]).toBe(0);
  });
});
