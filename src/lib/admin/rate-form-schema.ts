import { z } from 'zod';
import type { Period } from '@/lib/period';

/** Đơn giá chỉ áp dụng từ năm 2026 trở đi. */
export const FIRST_RATE_YEAR = 2026;

export const rateFormSchema = z.object({
  feeType: z.enum(['ROOM', 'TRASH', 'ELECTRIC', 'WATER']),
  effectiveYear: z.coerce
    .number()
    .int()
    .min(FIRST_RATE_YEAR, `Năm áp dụng phải từ ${FIRST_RATE_YEAR} trở đi`)
    .max(2100),
  effectiveMonth: z.coerce.number().int().min(1, 'Tháng phải từ 1 đến 12').max(12, 'Tháng phải từ 1 đến 12'),
  unitPrice: z.coerce.number().int().min(0, 'Đơn giá không được âm'),
});

export type RateFormInput = z.infer<typeof rateFormSchema>;

/**
 * Kiểm tra kỳ áp dụng so với thời điểm hiện tại. Trả về thông báo lỗi, hoặc
 * null nếu hợp lệ. Năm đã qua thì không nhận; cùng năm hiện tại thì tháng phải
 * lớn hơn tháng hiện tại; năm sau thì tháng nào cũng được.
 */
export function effectivePeriodError(period: Period, now: Date): string | null {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (period.year < currentYear) {
    return `Không thể đặt đơn giá cho năm ${period.year} đã qua`;
  }
  if (period.year === currentYear && period.month <= currentMonth) {
    return `Tháng áp dụng phải sau tháng hiện tại (tháng ${currentMonth}/${currentYear})`;
  }
  return null;
}
