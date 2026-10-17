'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { formatPeriod } from '@/lib/period';
import { validatePeriodImport, type ImportState } from '@/lib/admin/period-import';
import { readImportSheet } from '../period-import';
import { isPeriodLocked, loadPeriodGrid, writePeriodRows } from '../period-grid';
import { requireAdmin } from '../session';

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/** Server action giới hạn 1MB cho cả request; chừa chỗ cho phần còn lại của form. */
const MAX_FILE_BYTES = 900 * 1024;

/**
 * Tải file Excel nhập liệu một kỳ lên. Kiểm tra TOÀN BỘ file trước (đúng kỳ,
 * đúng cột, từng ô đúng kiểu như CSDL); có lỗi thì không ghi gì cả. Hợp lệ thì
 * ghi tất cả trong một transaction, cùng cách ghi với lưới nhập liệu trên web.
 */
export async function importPeriodExcel(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAdmin();

  const parsed = periodSchema.safeParse({ year: formData.get('year'), month: formData.get('month') });
  if (!parsed.success) return { status: 'error', errors: ['Kỳ không hợp lệ.'] };
  const period = parsed.data;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', errors: ['Chưa chọn file Excel.'] };
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { status: 'error', errors: [`File "${file.name}" không phải .xlsx. Hãy dùng file mẫu tải từ web.`] };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { status: 'error', errors: ['File quá lớn (tối đa 900KB). File mẫu chuẩn chỉ khoảng 10KB.'] };
  }

  if (await isPeriodLocked(period)) {
    return {
      status: 'error',
      errors: [`${formatPeriod(period)} đã khoá sổ nên không cập nhật được. Hãy mở khoá ở trang tổng quan năm trước.`],
    };
  }

  const read = await readImportSheet(await file.arrayBuffer());
  if (!read.ok) return { status: 'error', errors: [read.error] };

  // Chỉ số kỳ trước luôn lấy từ CSDL, không tin cột "kỳ trước" trong file.
  const { rows: gridRows } = await loadPeriodGrid(period);
  const previous = Object.fromEntries(
    gridRows.map((r) => [r.roomNumber, { electric: r.electricPrevious, water: r.waterPrevious }]),
  );

  const result = validatePeriodImport({ sheet: read.sheet, period, previous });
  if (!result.ok) return { status: 'error', errors: result.errors };

  await writePeriodRows(period, result.rows);

  revalidatePath(`/admin/ky/${period.year}/${period.month}`);
  revalidatePath('/admin');
  revalidatePath('/admin/phong');
  return {
    status: 'success',
    message: `Đã cập nhật ${result.rows.length} phòng cho ${formatPeriod(period)} từ file "${file.name}".`,
  };
}
