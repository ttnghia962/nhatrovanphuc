import { describe, it, expect } from 'vitest';
import { validateReading } from './validate-reading';

describe('validateReading', () => {
  it('chấp nhận chỉ số lớn hơn kỳ trước', () => {
    expect(validateReading(1495, 1500, false)).toEqual({ ok: true, error: null });
  });

  it('chấp nhận chỉ số bằng kỳ trước', () => {
    expect(validateReading(1495, 1495, false)).toEqual({ ok: true, error: null });
  });

  it('chấp nhận khi chưa có chỉ số kỳ trước', () => {
    expect(validateReading(null, 1500, false)).toEqual({ ok: true, error: null });
  });

  it('từ chối chỉ số nhỏ hơn kỳ trước', () => {
    expect(validateReading(1495, 1400, false)).toEqual({
      ok: false,
      error: 'Chỉ số mới (1400) không được nhỏ hơn chỉ số kỳ trước (1495)',
    });
  });

  it('từ chối số âm', () => {
    expect(validateReading(null, -1, false)).toEqual({
      ok: false,
      error: 'Chỉ số phải là số nguyên không âm',
    });
  });

  it('từ chối khi kỳ đã khoá sổ', () => {
    expect(validateReading(1495, 1500, true)).toEqual({
      ok: false,
      error: 'Kỳ này đã khoá sổ, vui lòng báo quản lý',
    });
  });
});
