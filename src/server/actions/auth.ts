'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { readAdminPin } from '../admin-pin';
import { clearSession, setSession } from '../session';

const roomSchema = z.coerce.number().int().min(1).max(32);

export async function loginAsTenant(formData: FormData) {
  const parsed = roomSchema.safeParse(formData.get('roomNumber'));
  if (!parsed.success) redirect('/login?loi=phong-khong-hop-le');

  await setSession({ role: 'tenant', roomNumber: parsed.data });
  redirect(`/phong/${parsed.data}`);
}

export async function loginAsAdmin(formData: FormData) {
  const pin = String(formData.get('pin') ?? '');
  const stored = await readAdminPin();

  // So sánh theo thời gian hằng định để không lộ thông tin qua thời gian phản hồi.
  const a = Buffer.from(pin);
  const b = Buffer.from(stored);
  const match = a.length === b.length && timingSafeEqual(a, b);

  if (!match) redirect('/login?loi=sai-pin');

  await setSession({ role: 'admin' });
  redirect('/admin');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}
