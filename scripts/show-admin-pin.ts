import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const setting = await prisma.setting.findUnique({ where: { key: 'ADMIN_PIN' } });
  console.log(setting ? `Ma PIN quan ly hien tai: ${setting.value}` : 'Chua co ma PIN trong DB.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
