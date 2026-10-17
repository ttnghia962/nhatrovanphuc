import { MONTHS } from '@/lib/period';
import { loadPeriodSummary, zeroTotals, type PeriodSummary, type PeriodTotals } from './billing';

export interface YearDashboard {
  year: number;
  /** 12 phần tử, chỉ số 0 là tháng 1. */
  monthlyTotals: PeriodTotals[];
  yearTotals: PeriodTotals;
  occupiedCountByMonth: number[];
}

function addTotals(a: PeriodTotals, b: PeriodTotals): PeriodTotals {
  return {
    roomFee: a.roomFee + b.roomFee,
    trashFee: a.trashFee + b.trashFee,
    electricFee: a.electricFee + b.electricFee,
    waterFee: a.waterFee + b.waterFee,
    lossFee: a.lossFee + b.lossFee,
    total: a.total + b.total,
  };
}

export function buildYearDashboard(year: number, summaries: PeriodSummary[]): YearDashboard {
  const monthlyTotals: PeriodTotals[] = [];
  const occupiedCountByMonth: number[] = [];
  let yearTotals = zeroTotals();

  for (const month of MONTHS) {
    const summary = summaries.find((s) => s.period.year === year && s.period.month === month);

    // Kỳ rỗng (chưa có MonthlyRecord và chưa có chỉ số nào) không được sinh
    // doanh thu: không cộng vào tổng năm, không đếm phòng có người ở.
    if (!summary || !summary.hasData) {
      monthlyTotals.push(zeroTotals());
      occupiedCountByMonth.push(0);
      continue;
    }

    monthlyTotals.push(summary.totals);
    occupiedCountByMonth.push(summary.rows.filter((r) => r.occupied).length);
    yearTotals = addTotals(yearTotals, summary.totals);
  }

  return { year, monthlyTotals, yearTotals, occupiedCountByMonth };
}

export async function loadYearDashboard(year: number): Promise<YearDashboard> {
  const summaries = await Promise.all(MONTHS.map((month) => loadPeriodSummary({ year, month })));
  return buildYearDashboard(year, summaries);
}
