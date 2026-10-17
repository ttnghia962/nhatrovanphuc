'use server';

import { redirect } from 'next/navigation';
import { validatePinChange } from '@/lib/admin/validate-pin-change';
import { readAdminPin, writeAdminPin } from '../admin-pin';
import { clearSession, requireAdmin } from '../session';

export async function changeAdminPin(formData: FormData) {
  await requireAdmin();

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const stored = await readAdminPin();
  const check = validatePinChange(current, stored, next, confirm);

  if (!check.ok) {
    redirect(`/admin/doi-ma-pin?loi=${encodeURIComponent(check.error!)}`);
  }

  await writeAdminPin(next);

  // Buộc đăng nhập lại bằng PIN mới để chắc chắn chủ trọ nhớ đúng mã.
  await clearSession();
  redirect('/login?loi=doi-pin-xong');
}
