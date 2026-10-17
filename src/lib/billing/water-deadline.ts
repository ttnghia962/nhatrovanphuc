import type { Period } from '@/lib/period';
import { previousPeriod } from '@/lib/period';

/** Ngày 10 của tháng kế tiếp được coi là hạn khóa. */
export const WATER_LOCK_DAY = 10;

/**
 * Thời điểm khóa chỉ số nước của một kỳ: 00:00 ngày 10 của tháng kế tiếp.
 * Tháng trong Date đếm từ 0, nên chỉ số `period.month` chính là tháng kế tiếp,
 * và JS tự chuyển sang năm sau khi period.month = 12.
 */
export function waterLockDate(period: Period): Date {
  return new Date(period.year, period.month, WATER_LOCK_DAY, 0, 0, 0, 0);
}

/** Đúng thời điểm 00:00 ngày 10 đã tính là đóng. */
export function isWaterEntryOpen(period: Period, now: Date): boolean {
  return now.getTime() < waterLockDate(period).getTime();
}

/** Câu chữ hiển thị cho khách thuê: hạn chót là hết ngày 9 tháng kế tiếp. */
export function formatWaterDeadline(period: Period): string {
  const lock = waterLockDate(period);
  const lastDay = new Date(lock.getTime() - 24 * 60 * 60 * 1000);

  const dd = String(lastDay.getDate()).padStart(2, '0');
  const mm = String(lastDay.getMonth() + 1).padStart(2, '0');

  return `hết ngày ${dd}/${mm}/${lastDay.getFullYear()}`;
}

/**
 * Kỳ mà khách thuê đang được nhập chỉ số nước tại thời điểm `now`.
 * Trước ngày 10 thì vẫn đang nhập cho tháng trước; từ ngày 10 trở đi
 * tháng trước đã khóa nên chuyển sang nhập cho tháng hiện tại.
 */
export function currentWaterEntryPeriod(now: Date): Period {
  const period: Period = { year: now.getFullYear(), month: now.getMonth() + 1 };
  return now.getDate() < WATER_LOCK_DAY ? previousPeriod(period) : period;
}
