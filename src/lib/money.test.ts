import { describe, it, expect } from 'vitest';
import { roundToThousand, formatVnd } from './money';

describe('roundToThousand', () => {
  it('làm tròn lên khi phần dư >= 500', () => {
    expect(roundToThousand(1412900)).toBe(1413000);
  });

  it('làm tròn xuống khi phần dư < 500', () => {
    expect(roundToThousand(1412400)).toBe(1412000);
  });

  it('giữ nguyên số đã tròn nghìn', () => {
    expect(roundToThousand(800000)).toBe(800000);
  });

  it('trả 0 cho 0', () => {
    expect(roundToThousand(0)).toBe(0);
  });
});

describe('formatVnd', () => {
  it('dùng dấu chấm phân tách hàng nghìn', () => {
    expect(formatVnd(1413000)).toBe('1.413.000');
  });
});
