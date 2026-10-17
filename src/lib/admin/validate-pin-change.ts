export interface PinChangeCheck {
  ok: boolean;
  error: string | null;
}

/** Mã PIN quản lý gồm đúng 8 chữ số. */
export const PIN_LENGTH = 8;
export const PIN_PATTERN = /^\d{8}$/;

/**
 * Kiểm tra yêu cầu đổi PIN.
 * Thứ tự kiểm tra có chủ đích: xác thực PIN hiện tại trước, rồi mới xét PIN mới.
 */
export function validatePinChange(
  current: string,
  storedPin: string,
  next: string,
  confirm: string,
): PinChangeCheck {
  if (current !== storedPin) {
    return { ok: false, error: 'Mã PIN hiện tại không đúng' };
  }
  if (!PIN_PATTERN.test(next)) {
    return { ok: false, error: `Mã PIN mới phải gồm đúng ${PIN_LENGTH} chữ số` };
  }
  if (next !== confirm) {
    return { ok: false, error: 'Hai lần nhập mã PIN mới không khớp nhau' };
  }
  if (next === storedPin) {
    return { ok: false, error: 'Mã PIN mới phải khác mã PIN hiện tại' };
  }
  return { ok: true, error: null };
}
