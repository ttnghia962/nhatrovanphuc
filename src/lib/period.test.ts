import { describe, it, expect } from 'vitest';
import { previousPeriod, comparePeriods, formatPeriod } from './period';

describe('previousPeriod', () => {
  it('lùi 1 tháng trong cùng năm', () => {
    expect(previousPeriod({ year: 2026, month: 8 })).toEqual({ year: 2026, month: 7 });
  });

  it('lùi từ tháng 1 sang tháng 12 năm trước', () => {
    expect(previousPeriod({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
  });
});

describe('comparePeriods', () => {
  it('trả số âm khi a trước b', () => {
    expect(comparePeriods({ year: 2026, month: 1 }, { year: 2026, month: 2 })).toBeLessThan(0);
  });

  it('trả 0 khi hai kỳ bằng nhau', () => {
    expect(comparePeriods({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(0);
  });

  it('so sánh năm trước, tháng sau', () => {
    expect(comparePeriods({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
  });
});

describe('formatPeriod', () => {
  it('hiển thị dạng Tháng M/YYYY', () => {
    expect(formatPeriod({ year: 2026, month: 8 })).toBe('Tháng 8/2026');
  });
});
