'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
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

  for (const row of rows) {
    await prisma.monthlyRecord.upsert({
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

    if (row.electricReading === null) {
      await prisma.meterReading.deleteMany({
        where: { roomNumber: row.roomNumber, meterType: 'ELECTRIC', year, month },
      });
      continue;
    }

    await prisma.meterReading.upsert({
      where: {
        roomNumber_meterType_year_month: {
          roomNumber: row.roomNumber,
          meterType: 'ELECTRIC',
          year,
          month,
        },
      },
      update: { value: row.electricReading, enteredBy: 'ADMIN' },
      create: {
        roomNumber: row.roomNumber,
        meterType: 'ELECTRIC',
        year,
        month,
        value: row.electricReading,
        enteredBy: 'ADMIN',
      },
    });
  }

  revalidatePath(`/admin/ky/${year}/${month}`);
  redirect(`/admin/ky/${year}/${month}?luu=xong`);
}
