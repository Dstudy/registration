import {
  PrismaClient,
  Role,
  UserStatus,
  ShiftPosition,
  RegistrationType,
  AttendanceStatus,
  NotificationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────

function buildDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function buildTime(hours: number, minutes: number): Date {
  const d = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  return d;
}

function getDayOfWeek(date: Date): number {
  return date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
}

function isWeekend(date: Date): boolean {
  const dow = getDayOfWeek(date);
  return dow === 0 || dow === 6; // Sun or Sat
}

interface ShiftTemplate {
  shiftName: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const WEEKDAY_SHIFTS: ShiftTemplate[] = [
  { shiftName: 'Ca Sáng', startHour: 8, startMin: 0, endHour: 12, endMin: 0 },
];

const WEEKEND_SHIFTS: ShiftTemplate[] = [
  { shiftName: 'Ca Sáng', startHour: 8, startMin: 0, endHour: 12, endMin: 0 },
  { shiftName: 'Ca Chiều', startHour: 13, startMin: 30, endHour: 17, endMin: 30 },
];

const POSITIONS = [ShiftPosition.PLACE_1, ShiftPosition.PLACE_2];

async function generateShiftsForMonth(year: number, month: number, publish = false) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const created: Array<{ id: number }> = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = buildDate(year, month, day);
    const templates = isWeekend(date) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;

    for (const tmpl of templates) {
      for (const position of POSITIONS) {
        const shift = await prisma.shiftInstance.upsert({
          where: {
            date_shiftName_position: {
              date,
              shiftName: tmpl.shiftName,
              position,
            },
          },
          update: {},
          create: {
            date,
            shiftName: tmpl.shiftName,
            position,
            startTime: buildTime(tmpl.startHour, tmpl.startMin),
            endTime: buildTime(tmpl.endHour, tmpl.endMin),
            maxSlots: 5,
            isActive: true,
            isPublished: publish,
          },
        });
        created.push({ id: shift.id });
      }
    }
  }

  return created;
}

// ─── Main ────────────────────────────────

async function main() {
  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  console.log('🌱 Seeding database...');

  // ── SystemConfig ──────────────────────

  await prisma.systemConfig.upsert({
    where: { key: 'registration_open' },
    update: {},
    create: { key: 'registration_open', value: 'false' },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'registration_month' },
    update: {},
    create: {
      key: 'registration_month',
      value: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
    },
  });

  console.log('✅ SystemConfig seeded');

  // ── Users ─────────────────────────────

  const adminPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
  const volPassword = await bcrypt.hash('volunteer123', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { ma_tnv: 'ADMIN001' },
    update: {},
    create: {
      ma_tnv: 'ADMIN001',
      password: adminPassword,
      fullname: 'Nguyễn Văn Admin',
      email: 'admin@vms.local',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      min_shifts_per_month: 0,
    },
  });

  const volunteerData = [
    { ma_tnv: 'B22DCPT001', fullname: 'Nguyễn Thị Lan', email: 'danh302004@gmail.com' },
    { ma_tnv: 'B22DCPT002', fullname: 'Trần Văn Minh', email: 'dduong302004@gmail.com' },
    { ma_tnv: 'B22DCPT003', fullname: 'Lê Thị Hoa', email: 'hoa@vms.local' },
    { ma_tnv: 'B22DCPT004', fullname: 'Phạm Văn Đức', email: 'duc@vms.local' },
    { ma_tnv: 'B22DCPT005', fullname: 'Hoàng Thị Mai', email: 'mai@vms.local' },
  ];

  const volunteers = await Promise.all(
    volunteerData.map((v) =>
      prisma.user.upsert({
        where: { ma_tnv: v.ma_tnv },
        update: {},
        create: {
          ...v,
          password: volPassword,
          role: Role.VOLUNTEER,
          status: UserStatus.ACTIVE,
          min_shifts_per_month: 2,
        },
      }),
    ),
  );

  console.log(`✅ Users seeded: 1 admin + ${volunteers.length} volunteers`);

  // ── Shift Instances ───────────────────

  // Current month: published (past shifts available for attendance seeding)
  await generateShiftsForMonth(currentYear, currentMonth, true);
  console.log(`✅ Shifts generated: ${currentYear}-${currentMonth} (published)`);

  // Next month: not yet published
  await generateShiftsForMonth(nextYear, nextMonth, false);
  console.log(`✅ Shifts generated: ${nextYear}-${nextMonth} (unpublished)`);

  // ── Registrations for current month ──

  // Get a few past shifts from current month to create registrations/attendance
  const pastDate = new Date(now);
  pastDate.setUTCDate(Math.max(1, now.getUTCDate() - 7)); // 7 days ago

  const pastShifts = await prisma.shiftInstance.findMany({
    where: {
      date: { lt: now },
      isPublished: true,
      isActive: true,
    },
    take: 10,
    orderBy: { date: 'asc' },
  });

  // Future shifts for open registrations
  const futureShifts = await prisma.shiftInstance.findMany({
    where: {
      date: { gte: now },
      isPublished: true,
      isActive: true,
    },
    take: 10,
    orderBy: { date: 'asc' },
  });

  const allShifts = [...pastShifts, ...futureShifts];
  let registrationCount = 0;

  for (let i = 0; i < Math.min(volunteers.length, allShifts.length); i++) {
    const vol = volunteers[i % volunteers.length];
    const shift = allShifts[i];

    await prisma.registration.upsert({
      where: { userId_shiftId: { userId: vol.id, shiftId: shift.id } },
      update: {},
      create: {
        userId: vol.id,
        shiftId: shift.id,
        registrationType: RegistrationType.SELF,
        isConfirmed: true,
      },
    });
    registrationCount++;
  }

  // Distribute more registrations
  for (let i = 0; i < volunteers.length && i < futureShifts.length - 1; i++) {
    const vol = volunteers[(i + 2) % volunteers.length];
    const shift = futureShifts[i + 1];

    try {
      await prisma.registration.upsert({
        where: { userId_shiftId: { userId: vol.id, shiftId: shift.id } },
        update: {},
        create: {
          userId: vol.id,
          shiftId: shift.id,
          registrationType: RegistrationType.SELF,
          isConfirmed: false,
        },
      });
      registrationCount++;
    } catch {
      // ignore duplicate
    }
  }

  console.log(`✅ Registrations seeded: ${registrationCount}`);

  // ── Attendance for past shifts ────────

  let attendanceCount = 0;
  const pastRegistrations = await prisma.registration.findMany({
    where: { shift: { date: { lt: now } } },
    include: { shift: true },
  });

  const statuses = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT];

  for (let i = 0; i < pastRegistrations.length; i++) {
    const reg = pastRegistrations[i];
    const status = statuses[i % statuses.length];

    await prisma.attendance.upsert({
      where: { userId_shiftId: { userId: reg.userId, shiftId: reg.shiftId } },
      update: {},
      create: {
        userId: reg.userId,
        shiftId: reg.shiftId,
        status,
        note: status === AttendanceStatus.LATE ? 'Đến muộn 15 phút' : null,
        updatedBy: reg.userId,
      },
    });
    attendanceCount++;
  }

  console.log(`✅ Attendance seeded: ${attendanceCount}`);

  // ── Notifications ─────────────────────

  const notificationTemplates = [
    {
      title: 'Chào mừng bạn!',
      content: 'Bạn đã được thêm vào hệ thống quản lý lịch trực TNV.',
      type: NotificationType.INFO,
    },
    {
      title: 'Đăng ký ca trực thành công',
      content: 'Bạn đã đăng ký thành công ca trực. Vui lòng kiểm tra email để xác nhận.',
      type: NotificationType.INFO,
    },
    {
      title: 'Nhắc nhở ca trực',
      content: 'Bạn có ca trực vào ngày mai. Đừng quên check-in nhé!',
      type: NotificationType.URGENT,
    },
  ];

  for (const vol of volunteers) {
    for (const tmpl of notificationTemplates) {
      await prisma.notification.create({
        data: {
          userId: vol.id,
          ...tmpl,
        },
      });
    }
  }

  console.log(`✅ Notifications seeded: ${volunteers.length * notificationTemplates.length}`);

  console.log('\n🎉 Seeding complete!\n');
  console.log('Accounts:');
  console.log('  Admin  → ma_tnv: ADMIN001      | password: admin123');
  console.log('  Volunteer → ma_tnv: B22DCPT001–005 | password: volunteer123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
