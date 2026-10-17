'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { rateFormSchema } from '@/lib/admin/rate-form-schema';
import { prisma } from '../db';
import { requireAdmin } from '../session';

export async function createRate(formData: FormData) {
  await requireAdmin();

  const parsed = rateFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect('/admin/don-gia?loi=' + encodeURIComponent('Dữ liệu đơn giá không hợp lệ'));
  }

  const { feeType, roomNumber, effectiveYear, effectiveMonth, unitPrice } = parsed.data;

  const existing = await prisma.rate.findFirst({
    where: { feeType, roomNumber, effectiveYear, effectiveMonth },
  });

  if (existing) {
    await prisma.rate.update({ where: { id: existing.id }, data: { unitPrice } });
  } else {
    await prisma.rate.create({
      data: { feeType, roomNumber, effectiveYear, effectiveMonth, unitPrice },
    });
  }

  revalidatePath('/admin/don-gia');
  redirect('/admin/don-gia?luu=xong');
}

export async function deleteRate(formData: FormData) {
  await requireAdmin();

  const id = z.coerce.number().int().safeParse(formData.get('id'));
  if (!id.success) redirect('/admin/don-gia');

  await prisma.rate.delete({ where: { id: id.data } });

  revalidatePath('/admin/don-gia');
  redirect('/admin/don-gia?luu=xong');
}
