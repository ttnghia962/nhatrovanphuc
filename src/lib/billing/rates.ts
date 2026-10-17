import { comparePeriods, type Period } from '@/lib/period';

export type FeeTypeName = 'ROOM' | 'TRASH' | 'ELECTRIC' | 'WATER';

export interface RateRow {
  feeType: FeeTypeName;
  /** null = áp dụng cho mọi phòng */
  roomNumber: number | null;
  effectiveYear: number;
  effectiveMonth: number;
  unitPrice: number;
}

function latestEffective(rows: RateRow[], period: Period): RateRow | null {
  let best: RateRow | null = null;
  for (const row of rows) {
    const effective: Period = { year: row.effectiveYear, month: row.effectiveMonth };
    if (comparePeriods(effective, period) > 0) continue;
    if (
      best === null ||
      comparePeriods(effective, { year: best.effectiveYear, month: best.effectiveMonth }) > 0
    ) {
      best = row;
    }
  }
  return best;
}

/**
 * Chọn đơn giá áp dụng cho một phòng tại một kỳ.
 * Ưu tiên đơn giá riêng của phòng; chỉ rơi về đơn giá chung khi phòng chưa có
 * đơn giá riêng nào có hiệu lực tại kỳ đó. Trả null nếu không tìm được.
 */
export function pickRate(
  rates: RateRow[],
  feeType: FeeTypeName,
  roomNumber: number,
  period: Period,
): number | null {
  const sameType = rates.filter((r) => r.feeType === feeType);

  const roomSpecific = latestEffective(
    sameType.filter((r) => r.roomNumber === roomNumber),
    period,
  );
  if (roomSpecific) return roomSpecific.unitPrice;

  const shared = latestEffective(
    sameType.filter((r) => r.roomNumber === null),
    period,
  );
  return shared ? shared.unitPrice : null;
}
