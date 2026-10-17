'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { effectivePeriodError, rateFormSchema } from '@/lib/admin/rate-form-schema';
import { prisma } from '../db';
import { requireAdmin } from '../session';

export async function createRate(formData: FormData) {
  await requireAdmin();

  const parsed = rateFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dữ liệu đơn giá không hợp lệ';
    redirect('/admin/don-gia?loi=' + encodeURIComponent(message));
  }

  const { feeType, effectiveYear, effectiveMonth, unitPrice } = parsed.data;

  const timeError = effectivePeriodError({ year: effectiveYear, month: effectiveMonth }, new Date());
  if (timeError) {
    redirect('/admin/don-gia?loi=' + encodeURIComponent(timeError));
  }

  // Đơn giá dùng chung cho mọi phòng, nên roomNumber luôn là null.
  let ok = true;
  try {
    const existing = await prisma.rate.findFirst({
      where: { feeType, roomNumber: null, effectiveYear, effectiveMonth },
    });

    if (existing) {
      await prisma.rate.update({ where: { id: existing.id }, data: { unitPrice } });
    } else {
      await prisma.rate.create({
        data: { feeType, roomNumber: null, effectiveYear, effectiveMonth, unitPrice },
      });
    }
  } catch {
    ok = false;
  }

  revalidatePath('/admin/don-gia');
  redirect(
    ok
      ? '/admin/don-gia?luu=xong'
      : `/admin/don-gia?loi=${encodeURIComponent('Không lưu được đơn giá, có thể vừa có người khác sửa cùng lúc. Vui lòng thử lại.')}`,
  );
}

export async function deleteRate(formData: FormData) {
  await requireAdmin();

  const id = z.coerce.number().int().safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/don-gia');

  let ok = true;
  try {
    await prisma.rate.delete({ where: { id: id.data } });
  } catch {
    ok = false;
  }

  revalidatePath('/admin/don-gia');
  redirect(
    ok
      ? '/admin/don-gia?luu=xong'
      : `/admin/don-gia?loi=${encodeURIComponent('Đơn giá này không còn tồn tại, có thể đã bị xoá rồi')}`,
  );
}
