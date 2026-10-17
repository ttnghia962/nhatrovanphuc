import type { RoomBill } from '@/lib/billing/calculate';
import { MoneyCell } from './money-cell';

export function RoomSummaryTable({ bill }: { bill: RoomBill }) {
  if (!bill.occupied) {
    return <p className="rounded bg-slate-100 p-4">Phòng này tháng đó không có người ở.</p>;
  }

  const lines: { label: string; value: number; hint?: string }[] = [
    { label: 'Tiền phòng', value: bill.roomFee },
    { label: 'Tiền rác', value: bill.trashFee },
    {
      label: 'Tiền điện',
      value: bill.electric.amount,
      hint:
        bill.electric.usage === null
          ? undefined
          : `${bill.electric.previous} → ${bill.electric.current} = ${bill.electric.usage} x ${bill.electric.unitPrice}`,
    },
    {
      label: 'Tiền nước',
      value: bill.water.amount,
      hint:
        bill.water.usage === null
          ? undefined
          : `${bill.water.previous} → ${bill.water.current} = ${bill.water.usage} x ${bill.water.unitPrice}`,
    },
    { label: 'Hao hụt 10%', value: bill.lossFee, hint: 'Tính trên tiền điện + tiền nước' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {bill.issues.length > 0 && (
        <ul className="rounded bg-amber-100 p-3 text-amber-900">
          {bill.issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      )}

      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line) => (
            <tr key={line.label} className="border-b">
              <th scope="row" className="p-3 text-left font-normal">
                {line.label}
                {line.hint && <span className="block text-xs text-slate-500">{line.hint}</span>}
              </th>
              <td className="p-3 text-right">
                <MoneyCell value={line.value} />
              </td>
            </tr>
          ))}
          <tr className="bg-slate-100 text-lg font-bold">
            <th scope="row" className="p-3 text-left">
              Tổng cộng
            </th>
            <td className="p-3 text-right">
              <MoneyCell value={bill.total} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
