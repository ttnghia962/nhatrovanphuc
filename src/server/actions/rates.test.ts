import { describe, it, expect } from 'vitest';
import { rateFormSchema } from '@/lib/admin/rate-form-schema';

describe('rateFormSchema', () => {
  it('chấp nhận đơn giá chung khi để trống số phòng', () => {
    const result = rateFormSchema.parse({
      feeType: 'ROOM',
      roomNumber: '',
      effectiveYear: '2026',
      effectiveMonth: '1',
      unitPrice: '800000',
    });

    expect(result).toEqual({
      feeType: 'ROOM',
      roomNumber: null,
      effectiveYear: 2026,
      effectiveMonth: 1,
      unitPrice: 800000,
    });
  });

  it('chấp nhận đơn giá riêng cho một phòng', () => {
    const result = rateFormSchema.parse({
      feeType: 'ROOM',
      roomNumber: '24',
      effectiveYear: '2025',
      effectiveMonth: '6',
      unitPrice: '300000',
    });

    expect(result.roomNumber).toBe(24);
  });

  it('từ chối loại phí không hợp lệ', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'INTERNET',
        roomNumber: '',
        effectiveYear: '2026',
        effectiveMonth: '1',
        unitPrice: '100',
      }),
    ).toThrow();
  });

  it('từ chối tháng ngoài khoảng 1..12', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'WATER',
        roomNumber: '',
        effectiveYear: '2026',
        effectiveMonth: '13',
        unitPrice: '7000',
      }),
    ).toThrow();
  });

  it('từ chối đơn giá âm', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'WATER',
        roomNumber: '',
        effectiveYear: '2026',
        effectiveMonth: '1',
        unitPrice: '-1',
      }),
    ).toThrow();
  });

  it('từ chối số phòng ngoài khoảng 1..32', () => {
    expect(() =>
      rateFormSchema.parse({
        feeType: 'ROOM',
        roomNumber: '33',
        effectiveYear: '2026',
        effectiveMonth: '1',
        unitPrice: '800000',
      }),
    ).toThrow();
  });
});
