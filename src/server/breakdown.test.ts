import { describe, it, expect } from 'vitest';
import { buildRoomYearBreakdown, buildRoomsYearOverview } from './breakdown';
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
    hasData: true,
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

  it('ghi chỉ số công tơ điện và số điện dùng của từng tháng', () => {
    const result = buildRoomYearBreakdown(1, 2026, [summary(7, bill()), summary(8, bill())]);

    expect(result.electricReading.months[7]).toBe(18852);
    expect(result.electricUsage.months[7]).toBe(144);
    // Số điện dùng cộng dồn được cả năm; chỉ số công tơ thì không.
    expect(result.electricUsage.total).toBe(288);
    expect(result.electricReading.total).toBe(0);
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

  it('kỳ rỗng (hasData=false) để null chứ không phải 0', () => {
    const empty: PeriodSummary = { ...summary(8, bill()), hasData: false };
    const result = buildRoomYearBreakdown(1, 2026, [empty]);

    expect(result.room.months[7]).toBeNull();
    expect(result.grandTotal.months[7]).toBeNull();
    expect(result.grandTotal.total).toBe(0);
  });
});

describe('buildRoomsYearOverview', () => {
  const rooms = [1, 2];

  function period(month: number, rows: RoomBill[]): PeriodSummary {
    return { ...summary(month, rows[0]), rows };
  }

  it('mỗi phòng một dòng, tổng từng tháng và cả năm', () => {
    const result = buildRoomsYearOverview(2026, rooms, [
      period(7, [bill(), bill({ roomNumber: 2, total: 1000000 })]),
      period(8, [bill(), bill({ roomNumber: 2, total: 1000000 })]),
    ]);

    expect(result.rows.map((r) => r.roomNumber)).toEqual([1, 2]);
    expect(result.rows[0].total.months[6]).toBe(1413000);
    expect(result.rows[0].total.total).toBe(2826000);
    expect(result.rows[1].total.total).toBe(2000000);
  });

  it('dòng cộng cả nhà trọ: cộng theo tháng, tháng chưa có dữ liệu để null', () => {
    const result = buildRoomsYearOverview(2026, rooms, [
      period(8, [bill(), bill({ roomNumber: 2, total: 1000000 })]),
    ]);

    expect(result.allRooms.months[7]).toBe(2413000);
    expect(result.allRooms.months[0]).toBeNull();
    expect(result.allRooms.total).toBe(2413000);
  });

  it('kỳ rỗng không sinh doanh thu', () => {
    const empty: PeriodSummary = { ...period(8, [bill()]), hasData: false };
    const result = buildRoomsYearOverview(2026, rooms, [empty]);

    expect(result.rows[0].total.months[7]).toBeNull();
    expect(result.allRooms.months[7]).toBeNull();
    expect(result.allRooms.total).toBe(0);
  });
});
