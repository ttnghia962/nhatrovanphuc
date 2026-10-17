import { describe, it, expect } from 'vitest';
import { computeConsumption } from './consumption';

describe('computeConsumption', () => {
  it('trả hiệu của chỉ số mới và chỉ số cũ', () => {
    expect(computeConsumption(18708, 18852, 'điện')).toEqual({ usage: 144, issue: null });
  });

  it('chấp nhận số tiêu thụ bằng 0', () => {
    expect(computeConsumption(1495, 1495, 'nước')).toEqual({ usage: 0, issue: null });
  });

  it('báo thiếu chỉ số kỳ trước', () => {
    expect(computeConsumption(null, 18852, 'điện')).toEqual({
      usage: null,
      issue: 'Thiếu chỉ số điện của kỳ trước',
    });
  });

  it('báo thiếu chỉ số kỳ này', () => {
    expect(computeConsumption(18708, null, 'nước')).toEqual({
      usage: null,
      issue: 'Thiếu chỉ số nước của kỳ này',
    });
  });

  it('báo lỗi khi chỉ số mới nhỏ hơn chỉ số cũ', () => {
    expect(computeConsumption(18852, 18708, 'điện')).toEqual({
      usage: null,
      issue: 'Chỉ số điện kỳ này (18708) nhỏ hơn kỳ trước (18852)',
    });
  });

  it('ưu tiên báo thiếu kỳ trước khi cả hai đều thiếu', () => {
    expect(computeConsumption(null, null, 'điện')).toEqual({
      usage: null,
      issue: 'Thiếu chỉ số điện của kỳ trước',
    });
  });
});
