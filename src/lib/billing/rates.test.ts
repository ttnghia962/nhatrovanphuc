import { describe, it, expect } from 'vitest';
import { pickRate, type RateRow } from './rates';

const rates: RateRow[] = [
  { feeType: 'ROOM', roomNumber: null, effectiveYear: 2025, effectiveMonth: 1, unitPrice: 700000 },
  { feeType: 'ROOM', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 800000 },
  { feeType: 'ROOM', roomNumber: 24, effectiveYear: 2025, effectiveMonth: 6, unitPrice: 300000 },
  { feeType: 'ELECTRIC', roomNumber: null, effectiveYear: 2026, effectiveMonth: 1, unitPrice: 3500 },
];

describe('pickRate', () => {
  it('lấy đơn giá chung có hiệu lực mới nhất không vượt quá kỳ', () => {
    expect(pickRate(rates, 'ROOM', 1, { year: 2026, month: 8 })).toBe(800000);
  });

  it('lấy đơn giá cũ khi kỳ nằm trước mốc đơn giá mới', () => {
    expect(pickRate(rates, 'ROOM', 1, { year: 2025, month: 12 })).toBe(700000);
  });

  it('đơn giá riêng của phòng thắng đơn giá chung dù mốc cũ hơn', () => {
    expect(pickRate(rates, 'ROOM', 24, { year: 2026, month: 8 })).toBe(300000);
  });

  it('rơi về đơn giá chung nếu đơn giá riêng chưa có hiệu lực', () => {
    expect(pickRate(rates, 'ROOM', 24, { year: 2025, month: 3 })).toBe(700000);
  });

  it('trả null khi không có đơn giá nào có hiệu lực', () => {
    expect(pickRate(rates, 'ELECTRIC', 1, { year: 2024, month: 1 })).toBeNull();
  });

  it('trả null khi không có loại phí đó', () => {
    expect(pickRate(rates, 'WATER', 1, { year: 2026, month: 8 })).toBeNull();
  });
});
