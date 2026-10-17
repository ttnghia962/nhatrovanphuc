'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { loadPeriodSummary } from '../billing';
import { prisma } from '../db';
import { requireAdmin } from '../session';

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  action: z.enum(['lock', 'unlock']),
});

/**
 * Khoá sổ một kỳ: tính lại toàn bộ rồi đóng băng kết quả vào snapshotJson,
 * để sau này sửa đơn giá không làm thay đổi số liệu quá khứ.
 *
 * Việc ghi 32 phòng được gói trong một transaction: nếu để rời rạc, một lỗi
 * giữa chừng có thể để lại tháng vừa khoá một phần vừa mở một phần, khiến
 * cùng một tháng bị tính theo hai cách khác nhau. redirect()/revalidatePath()
 * luôn được gọi SAU khi transaction đã resolve, vì redirect() hoạt động bằng
 * cách throw — nếu gọi trong transaction sẽ cuốn luôn các ghi vừa thực hiện.
 */
export async function lockPeriod(formData: FormData) {
  await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/admin');

  const { year, month, action } = parsed.data;

  if (action === 'unlock') {
    await prisma.monthlyRecord.updateMany({
      where: { year, month },
      data: { locked: false, snapshotJson: null },
    });
  } else {
    const summary = await loadPeriodSummary({ year, month });

    await prisma.$transaction(async (tx) => {
      for (const row of summary.rows) {
        await tx.monthlyRecord.upsert({
          where: { roomNumber_year_month: { roomNumber: row.roomNumber, year, month } },
          update: { locked: true, snapshotJson: JSON.stringify(row) },
          create: {
            roomNumber: row.roomNumber,
            year,
            month,
            tenantName: row.tenantName,
            occupied: row.occupied,
            locked: true,
            snapshotJson: JSON.stringify(row),
          },
        });
      }
    });
  }

  revalidatePath('/admin');
  revalidatePath(`/admin/ky/${year}/${month}`);
  redirect(`/admin?nam=${year}`);
}
