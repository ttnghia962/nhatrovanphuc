import { formatVnd } from '@/lib/money';

export function MoneyCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return <span className="tabular-nums">{formatVnd(value)}</span>;
}
