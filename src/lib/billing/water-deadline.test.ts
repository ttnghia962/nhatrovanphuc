import { describe, it, expect } from 'vitest';
import {
  waterLockDate,
  isWaterEntryOpen,
  formatWaterDeadline,
  currentWaterEntryPeriod,
} from './water-deadline';

describe('waterLockDate', () => {
  it('kỳ 9/2026 khóa lúc 00:00 ngày 10/10/2026', () => {
    expect(waterLockDate({ year: 2026, month: 9 })).toEqual(new Date(2026, 9, 10, 0, 0, 0, 0));
  });

  it('kỳ tháng 12 khóa vào tháng 1 năm sau', () => {
    expect(waterLockDate({ year: 2026, month: 12 })).toEqual(new Date(2027, 0, 10, 0, 0, 0, 0));
  });

  it('kỳ tháng 1 khóa ngày 10/2 cùng năm', () => {
    expect(waterLockDate({ year: 2026, month: 1 })).toEqual(new Date(2026, 1, 10, 0, 0, 0, 0));
  });
});

describe('isWaterEntryOpen', () => {
  it('còn mở trong chính tháng của kỳ', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 8, 25, 12, 0))).toBe(true);
  });

  it('còn mở hết ngày 9 của tháng kế tiếp', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 9, 9, 23, 59, 59))).toBe(true);
  });

  it('đã đóng đúng lúc 00:00 ngày 10 tháng kế tiếp', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 9, 10, 0, 0, 0))).toBe(false);
  });

  it('đã đóng sau ngày 10', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 9 }, new Date(2026, 9, 15, 8, 0))).toBe(false);
  });

  it('xử lý đúng ranh giới cuối năm', () => {
    expect(isWaterEntryOpen({ year: 2026, month: 12 }, new Date(2027, 0, 9, 20, 0))).toBe(true);
    expect(isWaterEntryOpen({ year: 2026, month: 12 }, new Date(2027, 0, 10, 0, 0))).toBe(false);
  });
});

describe('formatWaterDeadline', () => {
  it('hiển thị hạn chót theo ngày người dùng hiểu được', () => {
    expect(formatWaterDeadline({ year: 2026, month: 9 })).toBe('hết ngày 09/10/2026');
  });

  it('hiển thị đúng khi hạn rơi sang năm sau', () => {
    expect(formatWaterDeadline({ year: 2026, month: 12 })).toBe('hết ngày 09/01/2027');
  });
});

describe('currentWaterEntryPeriod', () => {
  it('trước ngày 10 thì vẫn đang nhập cho tháng trước', () => {
    expect(currentWaterEntryPeriod(new Date(2026, 9, 5))).toEqual({ year: 2026, month: 9 });
  });

  it('từ đúng ngày 10 thì chuyển sang nhập cho tháng hiện tại', () => {
    expect(currentWaterEntryPeriod(new Date(2026, 9, 10))).toEqual({ year: 2026, month: 10 });
  });

  it('sau ngày 10 vẫn là tháng hiện tại', () => {
    expect(currentWaterEntryPeriod(new Date(2026, 9, 25))).toEqual({ year: 2026, month: 10 });
  });

  it('đầu tháng 1 thì đang nhập cho tháng 12 năm trước', () => {
    expect(currentWaterEntryPeriod(new Date(2026, 0, 5))).toEqual({ year: 2025, month: 12 });
  });

  it('kỳ đang nhập luôn còn trong hạn', () => {
    const now = new Date(2026, 9, 5);
    expect(isWaterEntryOpen(currentWaterEntryPeriod(now), now)).toBe(true);
  });
});
