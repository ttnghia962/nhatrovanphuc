export interface PinChangeCheck {
  ok: boolean;
  error: string | null;
}

const SIX_DIGITS = /^\d{6}$/;

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
  if (!SIX_DIGITS.test(next)) {
    return { ok: false, error: 'Mã PIN mới phải gồm đúng 6 chữ số' };
  }
  if (next !== confirm) {
    return { ok: false, error: 'Hai lần nhập mã PIN mới không khớp nhau' };
  }
  if (next === storedPin) {
    return { ok: false, error: 'Mã PIN mới phải khác mã PIN hiện tại' };
  }
  return { ok: true, error: null };
}
