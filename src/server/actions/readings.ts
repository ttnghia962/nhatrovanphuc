'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { previousPeriod, formatPeriod } from '@/lib/period';
import { validateReading } from '@/lib/billing/validate-reading';
import { isWaterEntryOpen } from '@/lib/billing/water-deadline';
import { prisma } from '../db';
import { getSession } from '../session';

const schema = z.object({
  roomNumber: z.coerce.number().int().min(1).max(32),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  value: z.coerce.number().int().min(0),
});

export async function submitWaterReading(formData: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/login');

  const { roomNumber, year, month, value } = parsed.data;

  // Khách thuê chỉ được ghi cho phòng của chính mình.
  if (session.role === 'tenant' && session.roomNumber !== roomNumber) {
    redirect(`/phong/${session.roomNumber}`);
  }

  // Hạn nhập nước: khóa lúc 00:00 ngày 10 của tháng kế tiếp.
  // Admin vẫn sửa được sau hạn để còn chỉnh sai sót.
  if (session.role === 'tenant' && !isWaterEntryOpen({ year, month }, new Date())) {
    const message = `Đã quá hạn nhập chỉ số nước ${formatPeriod({ year, month })}. Vui lòng báo quản lý.`;
    redirect(`/phong/${roomNumber}/nuoc?loi=${encodeURIComponent(message)}`);
  }

  const prev = previousPeriod({ year, month });

  const [previousReading, record] = await Promise.all([
    prisma.meterReading.findUnique({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber,
          meterType: 'WATER',
          year: prev.year,
          month: prev.month,
        },
      },
    }),
    prisma.monthlyRecord.findUnique({
      where: { roomNumber_year_month: { roomNumber, year, month } },
    }),
  ]);

  const check = validateReading(previousReading?.value ?? null, value, record?.locked ?? false);

  if (!check.ok) {
    redirect(`/phong/${roomNumber}/nuoc?loi=${encodeURIComponent(check.error!)}`);
  }

  await prisma.meterReading.upsert({
    where: {
      roomNumber_meterType_year_month: { roomNumber, meterType: 'WATER', year, month },
    },
    update: { value, enteredBy: session.role === 'admin' ? 'ADMIN' : 'TENANT' },
    create: {
      roomNumber,
      meterType: 'WATER',
      year,
      month,
      value,
      enteredBy: session.role === 'admin' ? 'ADMIN' : 'TENANT',
    },
  });

  revalidatePath(`/phong/${roomNumber}`);
  redirect(`/phong/${roomNumber}?nam=${year}&thang=${month}`);
}
