import { PIN_LENGTH, PIN_PATTERN } from './validate-pin-change';

/**
 * PIN quản lý ban đầu, lấy từ biến môi trường ADMIN_INITIAL_PIN (file .env).
 * Không ghi PIN thật vào code: repo công khai trên GitHub, ai đọc được code sẽ
 * đăng nhập được trang quản lý của bản đang chạy thật.
 */
export function initialAdminPin(env: Record<string, string | undefined> = process.env): string {
  const value = env.ADMIN_INITIAL_PIN?.trim() ?? '';
  if (!PIN_PATTERN.test(value)) {
    throw new Error(
      `Thiếu hoặc sai biến môi trường ADMIN_INITIAL_PIN: phải gồm đúng ${PIN_LENGTH} chữ số, đặt trong file .env`,
    );
  }
  return value;
}
