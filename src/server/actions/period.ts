'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { formatPeriod } from '@/lib/period';
import { parsePeriodGrid } from '@/lib/admin/parse-period-grid';
import { prisma } from '../db';
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
  const lockedRecord = await prisma.monthlyRecord.findFirst({
    where: { year, month, locked: true },
    select: { roomNumber: true },
  });

  if (lockedRecord) {
    const message = `${formatPeriod({ year, month })} đã khoá sổ nên không lưu được. Hãy mở khoá ở trang tổng quan năm rồi sửa lại.`;
    redirect(`/admin/ky/${year}/${month}?loi=${encodeURIComponent(message)}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.monthlyRecord.upsert({
        where: { roomNumber_year_month: { roomNumber: row.roomNumber, year, month } },
        update: { tenantName: row.tenantName, occupied: row.occupied },
        create: {
          roomNumber: row.roomNumber,
          year,
          month,
          tenantName: row.tenantName,
          occupied: row.occupied,
        },
      });

      for (const [meterType, value] of [
        ['ELECTRIC', row.electricReading],
        ['WATER', row.waterReading],
      ] as const) {
        // Ô để trống nghĩa là xoá chỉ số, không phải ghi 0.
        if (value === null) {
          await tx.meterReading.deleteMany({
            where: { roomNumber: row.roomNumber, meterType, year, month },
          });
          continue;
        }

        await tx.meterReading.upsert({
          where: {
            roomNumber_meterType_year_month: {
              roomNumber: row.roomNumber,
              meterType,
              year,
              month,
            },
          },
          update: { value, enteredBy: 'ADMIN' },
          create: {
            roomNumber: row.roomNumber,
            meterType,
            year,
            month,
            value,
            enteredBy: 'ADMIN',
          },
        });
      }
    }
  });

  revalidatePath(`/admin/ky/${year}/${month}`);
  revalidatePath('/admin');
  redirect(`/admin/ky/${year}/${month}?luu=xong`);
}
