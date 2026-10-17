import type { PeriodSummary } from '@/server/billing';
import { MoneyCell } from './money-cell';

/** Chỉ số đồng hồ / số tiêu thụ: không phải tiền nên không dùng formatVnd. */
function NumberCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return <span className="tabular-nums">{value}</span>;
}

/**
 * Bảng TỔNG QUAN của một kỳ (FR-4) — bảng chính thay cho sổ tay giấy.
 * Dòng nào có cảnh báo được tô vàng và nội dung cảnh báo liệt kê ngay dưới
 * bảng, để quản lý thấy được chỗ thiếu dữ liệu trên cùng một màn hình.
 */
export function PeriodOverviewTable({ summary }: { summary: PeriodSummary }) {
  if (!summary.hasData) {
    return (
      <p className="rounded bg-slate-100 p-4">
        Kỳ này chưa có dữ liệu nào. Nhập ở lưới bên dưới rồi bấm “Lưu toàn bộ”.
      </p>
    );
  }

  const flagged = summary.rows.filter((row) => row.issues.length > 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th rowSpan={2} className="border p-2">
                Số phòng
              </th>
              <th rowSpan={2} className="border p-2 text-left">
                Họ và tên
              </th>
              <th rowSpan={2} className="border p-2 text-right">
                Tiền phòng
              </th>
              <th rowSpan={2} className="border p-2 text-right">
                Tiền rác
              </th>
              <th colSpan={5} className="border p-2">
                Điện
              </th>
              <th colSpan={5} className="border p-2">
                Nước
              </th>
              <th rowSpan={2} className="border p-2 text-right">
                Tiền hao hụt 10%
              </th>
              <th rowSpan={2} className="border p-2 text-right">
                Tổng
              </th>
            </tr>
            <tr className="bg-slate-100">
              <th className="border p-2 text-right">Số cũ</th>
              <th className="border p-2 text-right">Số mới</th>
              <th className="border p-2 text-right">TSD</th>
              <th className="border p-2 text-right">Đơn giá</th>
              <th className="border p-2 text-right">Thành tiền</th>
              <th className="border p-2 text-right">Số cũ</th>
              <th className="border p-2 text-right">Số mới</th>
              <th className="border p-2 text-right">TSD</th>
              <th className="border p-2 text-right">Đơn giá</th>
              <th className="border p-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr
                key={row.roomNumber}
                className={row.issues.length > 0 ? 'bg-amber-50' : undefined}
              >
                <td className="border p-2 text-center font-medium">
                  {row.roomNumber}
                  {row.issues.length > 0 && (
                    <span title={row.issues.join('; ')} className="ml-1 text-amber-700">
                      ⚠
                    </span>
                  )}
                </td>
                <td className="border p-2">{row.tenantName}</td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.roomFee} />
                </td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.trashFee} />
                </td>
                <td className="border p-2 text-right">
                  <NumberCell value={row.electric.previous} />
                </td>
                <td className="border p-2 text-right">
                  <NumberCell value={row.electric.current} />
                </td>
                <td className="border p-2 text-right">
                  <NumberCell value={row.electric.usage} />
                </td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.electric.unitPrice} />
                </td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.electric.amount} />
                </td>
                <td className="border p-2 text-right">
                  <NumberCell value={row.water.previous} />
                </td>
                <td className="border p-2 text-right">
                  <NumberCell value={row.water.current} />
                </td>
                <td className="border p-2 text-right">
                  <NumberCell value={row.water.usage} />
                </td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.water.unitPrice} />
                </td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.water.amount} />
                </td>
                <td className="border p-2 text-right">
                  <MoneyCell value={row.lossFee} />
                </td>
                <td className="border p-2 text-right font-semibold">
                  <MoneyCell value={row.total} />
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td className="border p-2 text-center">TỔNG CỘNG</td>
              <td className="border p-2" />
              <td className="border p-2 text-right">
                <MoneyCell value={summary.totals.roomFee} />
              </td>
              <td className="border p-2 text-right">
                <MoneyCell value={summary.totals.trashFee} />
              </td>
              <td className="border p-2" colSpan={4} />
              <td className="border p-2 text-right">
                <MoneyCell value={summary.totals.electricFee} />
              </td>
              <td className="border p-2" colSpan={4} />
              <td className="border p-2 text-right">
                <MoneyCell value={summary.totals.waterFee} />
              </td>
              <td className="border p-2 text-right">
                <MoneyCell value={summary.totals.lossFee} />
              </td>
              <td className="border p-2 text-right">
                <MoneyCell value={summary.totals.total} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {flagged.length > 0 && (
        <div className="rounded bg-amber-100 p-3 text-amber-900">
          <p className="font-semibold">Những phòng còn thiếu dữ liệu:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {flagged.map((row) => (
              <li key={row.roomNumber}>
                • Phòng {row.roomNumber}: {row.issues.join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
