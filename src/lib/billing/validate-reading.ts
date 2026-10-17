export interface ReadingCheck {
  ok: boolean;
  error: string | null;
}

/** Kiểm tra một chỉ số đồng hồ trước khi ghi vào DB. */
export function validateReading(
  previous: number | null,
  value: number,
  locked: boolean,
): ReadingCheck {
  if (locked) {
    return { ok: false, error: 'Kỳ này đã khoá sổ, vui lòng báo quản lý' };
  }
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, error: 'Chỉ số phải là số nguyên không âm' };
  }
  if (previous !== null && value < previous) {
    return {
      ok: false,
      error: `Chỉ số mới (${value}) không được nhỏ hơn chỉ số kỳ trước (${previous})`,
    };
  }
  return { ok: true, error: null };
}
