export interface ConsumptionResult {
  /** Số tiêu thụ, hoặc null khi không tính được. */
  usage: number | null;
  /** Mô tả vấn đề bằng tiếng Việt, hoặc null khi bình thường. */
  issue: string | null;
}

/**
 * Tính số tiêu thụ = chỉ số kỳ này trừ chỉ số kỳ trước.
 * Không bao giờ đoán hay thay bằng 0: thiếu dữ liệu thì trả usage = null kèm issue.
 * @param label nhãn tiếng Việt của loại đồng hồ, ví dụ 'điện' hoặc 'nước'
 */
export function computeConsumption(
  previous: number | null,
  current: number | null,
  label: string,
): ConsumptionResult {
  if (previous === null) {
    return { usage: null, issue: `Thiếu chỉ số ${label} của kỳ trước` };
  }
  if (current === null) {
    return { usage: null, issue: `Thiếu chỉ số ${label} của kỳ này` };
  }
  if (current < previous) {
    return {
      usage: null,
      issue: `Chỉ số ${label} kỳ này (${current}) nhỏ hơn kỳ trước (${previous})`,
    };
  }
  return { usage: current - previous, issue: null };
}
