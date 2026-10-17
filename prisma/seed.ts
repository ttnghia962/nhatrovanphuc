import { PrismaClient, FeeType } from '@prisma/client';
import { initialAdminPin } from '../src/lib/admin/initial-pin';

const prisma = new PrismaClient();

/** Đơn giá khởi điểm, lấy theo sổ tay tháng 8/2026. */
const BASE_RATES: { feeType: FeeType; unitPrice: number; note: string }[] = [
  { feeType: FeeType.ROOM, unitPrice: 800000, note: 'Tiền phòng mặc định' },
  { feeType: FeeType.TRASH, unitPrice: 20000, note: 'Tiền rác' },
  { feeType: FeeType.ELECTRIC, unitPrice: 3500, note: 'Đơn giá điện mỗi kWh' },
  { feeType: FeeType.WATER, unitPrice: 7000, note: 'Đơn giá nước mỗi khối' },
];

async function main() {
  for (let number = 1; number <= 32; number++) {
    await prisma.room.upsert({
      where: { number },
      update: {},
      create: { number, defaultTenantName: '' },
    });
  }

  for (const rate of BASE_RATES) {
    const existing = await prisma.rate.findFirst({
      where: {
        feeType: rate.feeType,
        roomNumber: null,
        effectiveYear: 2026,
        effectiveMonth: 1,
      },
    });

    if (existing) {
      await prisma.rate.update({
        where: { id: existing.id },
        data: { unitPrice: rate.unitPrice, note: rate.note },
      });
    } else {
      await prisma.rate.create({
        data: {
          feeType: rate.feeType,
          roomNumber: null,
          effectiveYear: 2026,
          effectiveMonth: 1,
          unitPrice: rate.unitPrice,
          note: rate.note,
        },
      });
    }
  }

  // PIN quản lý ban đầu lấy từ .env (ADMIN_INITIAL_PIN). Không ghi đè nếu admin đã đổi.
  await prisma.setting.upsert({
    where: { key: 'ADMIN_PIN' },
    update: {},
    create: { key: 'ADMIN_PIN', value: initialAdminPin() },
  });

  console.log('Seed xong: 32 phong, 4 don gia chung, PIN quan ly lay tu ADMIN_INITIAL_PIN trong .env.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
