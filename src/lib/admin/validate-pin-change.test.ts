import { describe, it, expect } from 'vitest';
import { validatePinChange } from './validate-pin-change';

describe('validatePinChange', () => {
  it('chấp nhận khi PIN hiện tại đúng và PIN mới hợp lệ, khớp nhau', () => {
    expect(validatePinChange('00000000', '00000000', '13579024', '13579024')).toEqual({
      ok: true,
      error: null,
    });
  });

  it('từ chối khi PIN hiện tại sai', () => {
    expect(validatePinChange('11111111', '00000000', '13579024', '13579024')).toEqual({
      ok: false,
      error: 'Mã PIN hiện tại không đúng',
    });
  });

  it('từ chối PIN mới không đủ 8 chữ số', () => {
    expect(validatePinChange('00000000', '00000000', '135790', '135790')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải gồm đúng 8 chữ số',
    });
  });

  it('từ chối PIN mới dài hơn 8 chữ số', () => {
    expect(validatePinChange('00000000', '00000000', '135790246', '135790246')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải gồm đúng 8 chữ số',
    });
  });

  it('từ chối PIN mới có ký tự không phải chữ số', () => {
    expect(validatePinChange('00000000', '00000000', '12a45678', '12a45678')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải gồm đúng 8 chữ số',
    });
  });

  it('chấp nhận PIN mới toàn số 0', () => {
    expect(validatePinChange('13579024', '13579024', '00000000', '00000000').ok).toBe(true);
  });

  it('từ chối khi hai lần nhập PIN mới không khớp', () => {
    expect(validatePinChange('00000000', '00000000', '13579024', '13579025')).toEqual({
      ok: false,
      error: 'Hai lần nhập mã PIN mới không khớp nhau',
    });
  });

  it('từ chối khi PIN mới trùng PIN cũ', () => {
    expect(validatePinChange('00000000', '00000000', '00000000', '00000000')).toEqual({
      ok: false,
      error: 'Mã PIN mới phải khác mã PIN hiện tại',
    });
  });
});
