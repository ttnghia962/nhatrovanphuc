import { FEE_TYPE_LABELS, type FeeTypeName } from '@/lib/billing/rates';
import { formatVnd } from '@/lib/money';
import { prisma } from '@/server/db';
import { createRate, deleteRate } from '@/server/actions/rates';

const FEE_TYPES: FeeTypeName[] = ['ROOM', 'TRASH', 'ELECTRIC', 'WATER'];

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ luu?: string; loi?: string }>;
}) {
  const { luu, loi } = await searchParams;

  const rates = await prisma.rate.findMany({
    orderBy: [{ feeType: 'asc' }, { effectiveYear: 'desc' }, { effectiveMonth: 'desc' }],
  });

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Đơn giá theo mốc thời gian</h1>

      {luu === 'xong' && <p className="rounded bg-green-100 p-3 text-green-900">Đã lưu.</p>}
      {loi && <p className="rounded bg-red-100 p-3 text-red-800">{loi}</p>}

      <form action={createRate} className="flex flex-wrap items-end gap-3 rounded border p-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Loại phí</span>
          <select name="feeType" className="rounded border p-2">
            {FEE_TYPES.map((t) => (
              <option key={t} value={t}>
                {FEE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Phòng (để trống = áp dụng chung)</span>
          <input name="roomNumber" type="number" min={1} max={32} className="w-40 rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Áp dụng từ năm</span>
          <input name="effectiveYear" type="number" defaultValue={2026} className="w-28 rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Tháng</span>
          <input name="effectiveMonth" type="number" min={1} max={12} defaultValue={1} className="w-20 rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Đơn giá (VND)</span>
          <input name="unitPrice" type="number" min={0} required className="w-40 rounded border p-2" />
        </label>

        <button type="submit" className="rounded bg-blue-600 px-5 py-2 font-medium text-white">
          Thêm / cập nhật
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Loại phí</th>
            <th className="p-2 text-left">Phạm vi</th>
            <th className="p-2 text-left">Áp dụng từ</th>
            <th className="p-2 text-right">Đơn giá</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id} className="border-b">
              <td className="p-2">{FEE_TYPE_LABELS[rate.feeType as FeeTypeName]}</td>
              <td className="p-2">{rate.roomNumber ? `Phòng ${rate.roomNumber}` : 'Tất cả phòng'}</td>
              <td className="p-2">
                {rate.effectiveMonth}/{rate.effectiveYear}
              </td>
              <td className="p-2 text-right tabular-nums">{formatVnd(rate.unitPrice)}</td>
              <td className="p-2 text-right">
                <form action={deleteRate}>
                  <input type="hidden" name="id" value={rate.id} />
                  <button type="submit" className="text-red-600 underline">
                    Xoá
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
