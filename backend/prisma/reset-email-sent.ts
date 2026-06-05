import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const month = process.argv[2]; // optional: YYYY-MM

  let where: Parameters<typeof prisma.registration.updateMany>[0]['where'] = {
    emailSentAt: { not: null },
  };

  if (month) {
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) {
      console.error('Invalid month format. Use YYYY-MM, e.g. 2026-06');
      process.exit(1);
    }
    where = {
      emailSentAt: { not: null },
      shift: {
        date: {
          gte: new Date(Date.UTC(year, m - 1, 1)),
          lte: new Date(Date.UTC(year, m, 0, 23, 59, 59)),
        },
      },
    };
  }

  const result = await prisma.registration.updateMany({
    where,
    data: { emailSentAt: null },
  });

  const scope = month ? `tháng ${month}` : 'tất cả';
  console.log(`Reset emailSentAt cho ${result.count} đăng ký (${scope})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
