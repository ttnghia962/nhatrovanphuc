import { describe, it, expect } from 'vitest';
import { effectivePeriodError, rateFormSchema } from '@/lib/admin/rate-form-schema';

describe('rateFormSchema', () => {
  it('nhận đơn giá chung cho mọi phòng', () => {
    const result = rateFormSchema.parse({
      feeType: 'ROOM',
      effectiveYear: '2026',
      effectiveMonth: '1',
      unitPrice: '800000',
    });

    expect(result).toEqual({
      feeType: 'ROOM',
      effectiveYear: 2026,
      effectiveMonth: 1,
      unitPrice: 800000,
    });
  });

  it('bỏ qua số phòng nếu form gửi lên', () => {
    const result = rateFormSchema.parse({
      feeType: 'ELECTRIC',
      roomNumber: '24',
      effectiveYear: '2026',
      effectiveMonth: '1',
      unitPrice: '3500',
    });

    expect(result).not.toHaveProperty('roomNumber');
  });

  it('từ chối loại phí không hợp lệ', () => {
    expect(() =>
      rateFormSchema.parse({ feeType: 'INTERNET', effectiveYear: '2026', effectiveMonth: '1', unitPrice: '100' }),
    ).toThrow();
  });

  it('từ chối năm từ 2025 trở xuống', () => {
    expect(() =>
      rateFormSchema.parse({ feeType: 'WATER', effectiveYear: '2025', effectiveMonth: '1', unitPrice: '7000' }),
    ).toThrow('Năm áp dụng phải từ 2026 trở đi');
  });

  it('từ chối tháng ngoài khoảng 1..12', () => {
    expect(() =>
      rateFormSchema.parse({ feeType: 'WATER', effectiveYear: '2026', effectiveMonth: '13', unitPrice: '7000' }),
    ).toThrow('Tháng phải từ 1 đến 12');
    expect(() =>
      rateFormSchema.parse({ feeType: 'WATER', effectiveYear: '2026', effectiveMonth: '0', unitPrice: '7000' }),
    ).toThrow('Tháng phải từ 1 đến 12');
  });

  it('từ chối đơn giá âm', () => {
    expect(() =>
      rateFormSchema.parse({ feeType: 'WATER', effectiveYear: '2026', effectiveMonth: '1', unitPrice: '-1' }),
    ).toThrow('Đơn giá không được âm');
  });
});

describe('effectivePeriodError', () => {
  // Hôm nay là 17/10/2026: tháng 10 đã qua giữa chừng, nên áp dụng từ tháng 11 trở đi.
  const now = new Date(2026, 9, 17);

  it('từ chối năm đã qua', () => {
    expect(effectivePeriodError({ year: 2025, month: 12 }, now)).not.toBeNull();
  });

  it('từ chối tháng hiện tại và tháng đã qua trong cùng năm', () => {
    expect(effectivePeriodError({ year: 2026, month: 10 }, now)).not.toBeNull();
    expect(effectivePeriodError({ year: 2026, month: 3 }, now)).not.toBeNull();
  });

  it('nhận tháng sau tháng hiện tại trong cùng năm', () => {
    expect(effectivePeriodError({ year: 2026, month: 11 }, now)).toBeNull();
  });

  it('nhận mọi tháng của năm sau', () => {
    expect(effectivePeriodError({ year: 2027, month: 1 }, now)).toBeNull();
    expect(effectivePeriodError({ year: 2027, month: 12 }, now)).toBeNull();
  });
});
