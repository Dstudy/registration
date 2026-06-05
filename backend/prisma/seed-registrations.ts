import {
  PrismaClient,
  RegistrationType,
  AttendanceStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const YEAR = 2026;
  const MONTH = 6; // June

  console.log(`\n🌱 Seeding registrations for ${YEAR}-${String(MONTH).padStart(2, '0')}...\n`);

  // ── Fetch volunteers ──────────────────────────────────────
  const volunteers = await prisma.user.findMany({
    where: { role: 'VOLUNTEER', status: 'ACTIVE' },
    orderBy: { ma_tnv: 'asc' },
  });

  if (volunteers.length === 0) {
    console.error('❌ No active volunteers found. Run the base seed first.');
    process.exit(1);
  }

  console.log(`Found ${volunteers.length} volunteers:`);
  volunteers.forEach((v) => console.log(`  • ${v.ma_tnv} – ${v.fullname}`));

  // ── Fetch published shifts for the month ──────────────────
  const monthStart = new Date(Date.UTC(YEAR, MONTH - 1, 1));
  const monthEnd = new Date(Date.UTC(YEAR, MONTH, 1)); // exclusive

  const shifts = await prisma.shiftInstance.findMany({
    where: {
      date: { gte: monthStart, lt: monthEnd },
      isPublished: true,
      isActive: true,
    },
    orderBy: { date: 'asc' },
  });

  if (shifts.length === 0) {
    console.error('❌ No published shifts found for June 2026. Publish shifts first.');
    process.exit(1);
  }

  console.log(`\nFound ${shifts.length} published shifts for ${YEAR}-${String(MONTH).padStart(2, '0')}`);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // ── Registration plan ─────────────────────────────────────
  // Spread volunteers across shifts. Each volunteer gets ~60-80% of shifts.
  // Rotate so shift coverage is distributed and each slot gets 2-4 volunteers.

  const registrations: { userId: number; shiftId: number; confirmed: boolean }[] = [];

  for (let si = 0; si < shifts.length; si++) {
    const shift = shifts[si];
    // Pick 2-3 volunteers per shift, rotating offset each day
    const baseIdx = si % volunteers.length;
    const count = 2 + (si % 2); // alternates 2 and 3
    for (let k = 0; k < count; k++) {
      const vol = volunteers[(baseIdx + k) % volunteers.length];
      // Past or today = confirmed; future = 50% confirmed
      const isPast = shift.date <= today;
      const confirmed = isPast ? true : si % 3 !== 0; // ~2/3 confirmed for future
      registrations.push({ userId: vol.id, shiftId: shift.id, confirmed });
    }
  }

  // Deduplicate (userId + shiftId)
  const seen = new Set<string>();
  const unique = registrations.filter((r) => {
    const key = `${r.userId}-${r.shiftId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nCreating ${unique.length} registrations...`);

  let created = 0;
  let skipped = 0;

  for (const r of unique) {
    try {
      await prisma.registration.upsert({
        where: { userId_shiftId: { userId: r.userId, shiftId: r.shiftId } },
        update: { isConfirmed: r.confirmed },
        create: {
          userId: r.userId,
          shiftId: r.shiftId,
          registrationType: RegistrationType.SELF,
          isConfirmed: r.confirmed,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`✅ Registrations: ${created} upserted, ${skipped} errors`);

  // ── Attendance for past registrations ─────────────────────
  const pastRegs = await prisma.registration.findMany({
    where: {
      shift: {
        date: { gte: monthStart, lt: today },
      },
    },
    include: { shift: true },
  });

  const statusCycle: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.ABSENT,
  ];

  let attCreated = 0;

  for (let i = 0; i < pastRegs.length; i++) {
    const reg = pastRegs[i];
    const status = statusCycle[i % statusCycle.length];

    await prisma.attendance.upsert({
      where: { userId_shiftId: { userId: reg.userId, shiftId: reg.shiftId } },
      update: {},
      create: {
        userId: reg.userId,
        shiftId: reg.shiftId,
        status,
        note:
          status === AttendanceStatus.LATE
            ? 'Đến muộn 10 phút'
            : status === AttendanceStatus.ABSENT
              ? 'Vắng không phép'
              : null,
        updatedBy: reg.userId,
      },
    });
    attCreated++;
  }

  console.log(`✅ Attendance records: ${attCreated} upserted for past shifts`);

  // ── Summary ───────────────────────────────────────────────
  const totalRegs = await prisma.registration.count({
    where: { shift: { date: { gte: monthStart, lt: monthEnd } } },
  });
  const confirmedRegs = await prisma.registration.count({
    where: { shift: { date: { gte: monthStart, lt: monthEnd } }, isConfirmed: true },
  });

  console.log(`\n📊 Summary for June 2026:`);
  console.log(`   Total registrations : ${totalRegs}`);
  console.log(`   Confirmed           : ${confirmedRegs}`);
  console.log(`   Pending             : ${totalRegs - confirmedRegs}`);
  console.log(`   Attendance records  : ${attCreated}`);
  console.log('\n🎉 Done!\n');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
