import { initialAdminPin } from '@/lib/admin/initial-pin';
import { prisma } from './db';

export const ADMIN_PIN_KEY = 'ADMIN_PIN';

/**
 * Đọc PIN quản lý từ DB. Nếu chưa có bản ghi (DB chưa seed) thì tạo bản ghi
 * bằng PIN ban đầu trong .env (ADMIN_INITIAL_PIN) để chủ trọ luôn vào được
 * trang quản lý.
 */
export async function readAdminPin(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: ADMIN_PIN_KEY } });
  if (setting) return setting.value;

  const pin = initialAdminPin();
  await prisma.setting.create({ data: { key: ADMIN_PIN_KEY, value: pin } });
  return pin;
}

export async function writeAdminPin(pin: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: ADMIN_PIN_KEY },
    update: { value: pin },
    create: { key: ADMIN_PIN_KEY, value: pin },
  });
}
