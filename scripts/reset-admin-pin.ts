import { PrismaClient } from '@prisma/client';
import { initialAdminPin } from '../src/lib/admin/initial-pin';

/**
 * Đặt lại mã PIN quản lý về ADMIN_INITIAL_PIN trong .env.
 * Dùng khi admin quên PIN, hoặc khi chuyển PIN cũ (6 số) sang chuẩn 8 số.
 * Lưu ý: các thiết bị đang đăng nhập không bị đăng xuất; muốn đăng xuất hết
 * thì đổi SESSION_SECRET.
 */
const prisma = new PrismaClient();

async function main() {
  const pin = initialAdminPin();
  await prisma.setting.upsert({
    where: { key: 'ADMIN_PIN' },
    update: { value: pin },
    create: { key: 'ADMIN_PIN', value: pin },
  });
  console.log('Da dat lai ma PIN quan ly theo ADMIN_INITIAL_PIN trong .env.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
