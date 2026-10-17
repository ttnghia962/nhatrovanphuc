export type Period = { year: number; month: number };

export const MONTHS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function previousPeriod(p: Period): Period {
  if (p.month === 1) return { year: p.year - 1, month: 12 };
  return { year: p.year, month: p.month - 1 };
}

export function comparePeriods(a: Period, b: Period): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function formatPeriod(p: Period): string {
  return `Tháng ${p.month}/${p.year}`;
}
