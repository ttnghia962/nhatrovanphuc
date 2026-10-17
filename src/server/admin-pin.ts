import { prisma } from './db';

export const ADMIN_PIN_KEY = 'ADMIN_PIN';
export const DEFAULT_ADMIN_PIN = '000000';

/**
 * Đọc PIN quản lý từ DB. Nếu chưa có bản ghi (DB chưa seed) thì tạo bản ghi
 * mặc định 000000 để chủ trọ luôn vào được trang quản lý.
 */
export async function readAdminPin(): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: ADMIN_PIN_KEY } });
  if (setting) return setting.value;

  await prisma.setting.create({ data: { key: ADMIN_PIN_KEY, value: DEFAULT_ADMIN_PIN } });
  return DEFAULT_ADMIN_PIN;
}

export async function writeAdminPin(pin: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: ADMIN_PIN_KEY },
    update: { value: pin },
    create: { key: ADMIN_PIN_KEY, value: pin },
  });
}
