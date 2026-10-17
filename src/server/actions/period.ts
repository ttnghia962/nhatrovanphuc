'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { formatPeriod } from '@/lib/period';
import { parsePeriodGrid } from '@/lib/admin/parse-period-grid';
import { isPeriodLocked, writePeriodRows } from '../period-grid';
import { requireAdmin } from '../session';

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function savePeriodGrid(formData: FormData) {
  await requireAdmin();

  const parsed = periodSchema.safeParse({
    year: formData.get('year'),
    month: formData.get('month'),
  });
  if (!parsed.success) redirect('/admin');

  const { year, month } = parsed.data;
  const rows = parsePeriodGrid(formData);

  // Kỳ đã khoá sổ thì tuyệt đối không ghi. Nếu cho ghi, bảng hiển thị vẫn lấy
  // theo snapshot nên trông như không có gì thay đổi, nhưng MeterReading đã bị
  // sửa — làm chỉ số "kỳ trước" của tháng sau lệch đi mà không ai thấy.
  if (await isPeriodLocked({ year, month })) {
    const message = `${formatPeriod({ year, month })} đã khoá sổ nên không lưu được. Hãy mở khoá ở trang tổng quan năm rồi sửa lại.`;
    redirect(`/admin/ky/${year}/${month}?tab=nhap-lieu&loi=${encodeURIComponent(message)}`);
  }

  await writePeriodRows({ year, month }, rows);

  revalidatePath(`/admin/ky/${year}/${month}`);
  revalidatePath('/admin');
  // Lưu xong ở lại tab Nhập liệu để thấy thông báo và sửa tiếp.
  redirect(`/admin/ky/${year}/${month}?tab=nhap-lieu&luu=xong`);
}
