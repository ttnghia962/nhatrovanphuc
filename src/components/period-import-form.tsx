'use client';

import { useActionState } from 'react';
import type { ImportState } from '@/lib/admin/period-import';
import { importPeriodExcel } from '@/server/actions/period-import';

const MAX_SHOWN_ERRORS = 30;

/** Khối "Nhập bằng Excel" trên trang kỳ: tải file mẫu, tải file đã điền lên. */
export function PeriodImportForm({ year, month, locked }: { year: number; month: number; locked: boolean }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importPeriodExcel, { status: 'idle' });

  return (
    <section className="flex flex-col gap-3 rounded border p-4">
      <h2 className="font-semibold">Nhập bằng Excel</h2>
      <p className="text-sm text-slate-600">
        Tải file mẫu (đã điền sẵn dữ liệu hiện tại), sửa trong Excel rồi tải lên. Cả file được kiểm tra trước; có lỗi
        thì không lưu gì và web sẽ chỉ ra từng dòng cần sửa.
      </p>

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <a
          href={`/api/period-template?nam=${year}&thang=${month}`}
          className="flex h-11 w-full items-center justify-center rounded border border-green-700 px-4 text-green-800 sm:w-auto"
        >
          Tải file mẫu
        </a>
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={locked || pending}
          // Ô cao 44px: nút "chọn file" bên trong cao 32px + đệm 5px trên dưới + viền, để chữ nằm giữa.
          className="h-11 w-full rounded border px-1.5 py-[5px] text-sm file:mr-3 file:h-8 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:text-sm sm:w-auto"
        />
        <button
          type="submit"
          disabled={locked || pending}
          className="h-11 w-full rounded bg-blue-600 px-5 font-medium text-white disabled:bg-slate-400 sm:w-auto"
        >
          {pending ? 'Đang kiểm tra…' : 'Tải lên và cập nhật'}
        </button>
      </form>

      {locked && <p className="text-sm text-amber-800">Kỳ đã khoá sổ nên không tải lên được.</p>}

      <div aria-live="polite">
        {state.status === 'success' && (
          <p className="rounded bg-green-100 p-3 text-green-900">{state.message}</p>
        )}
        {state.status === 'error' && (
          <div className="rounded bg-red-100 p-3 text-red-800">
            <p className="font-semibold">Chưa lưu gì. Hãy sửa {state.errors.length} lỗi sau rồi tải lên lại:</p>
            <ul className="mt-1 flex flex-col gap-1">
              {state.errors.slice(0, MAX_SHOWN_ERRORS).map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
            {state.errors.length > MAX_SHOWN_ERRORS && (
              <p className="mt-1">… và {state.errors.length - MAX_SHOWN_ERRORS} lỗi khác.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
