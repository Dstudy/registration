import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../common/services/system-config.service';
import { RegistrationType } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  // ─── Volunteer Self-Registration ────────────

  async register(userId: number, shiftId: number) {
    const isOpen = await this.systemConfig.isRegistrationOpen();
    if (!isOpen) {
      throw new ForbiddenException('Ngoài thời gian đăng ký ca trực');
    }

    // Race-condition-safe transaction with row-level lock
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the shift row before counting
        const shifts = await tx.$queryRaw<Array<{
          id: number;
          isActive: boolean;
          isPublished: boolean;
          maxSlots: number;
          date: Date;
          shiftName: string;
        }>>`
          SELECT id, isActive, isPublished, maxSlots, date, shiftName
          FROM ShiftInstance
          WHERE id = ${shiftId}
          FOR UPDATE
        `;

        const shift = shifts[0];
        if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
        if (!shift.isActive) throw new ForbiddenException('Ca trực không hoạt động');
        if (!shift.isPublished) throw new ForbiddenException('Ca trực chưa được công bố');

        const registrationCount = await tx.registration.count({
          where: { shiftId },
        });

        if (registrationCount >= shift.maxSlots) {
          throw new ConflictException('Ca trực đã đầy');
        }

        const existing = await tx.registration.findUnique({
          where: { userId_shiftId: { userId, shiftId } },
        });
        if (existing) throw new ConflictException('Bạn đã đăng ký ca trực này');

        const shiftDate = new Date(shift.date);
        const year = shiftDate.getUTCFullYear();
        const month = shiftDate.getUTCMonth();
        const startDate = new Date(Date.UTC(year, month, 1));
        const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

        const userMonthlyRegistrationCount = await tx.registration.count({
          where: {
            userId,
            shift: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
        });

        if (userMonthlyRegistrationCount >= 5) {
          throw new ConflictException('Bạn chỉ được đăng ký tối đa 5 ca trực trong một tháng');
        }

        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const flexiblePref = await tx.flexibleRegistrationPreference.findUnique({
          where: { userId_month: { userId, month: monthStr } },
        });
        if (flexiblePref) {
          throw new ConflictException(
            "Bạn đang bật tùy chọn 'Lịch nào cũng được'. Vui lòng tắt tùy chọn này nếu muốn tự chọn ca trực.",
          );
        }

        await this.checkSameShiftConflict(tx, userId, shiftId, shift.date, shift.shiftName);

        const confirmationToken = crypto.randomBytes(32).toString('hex');

        return tx.registration.create({
          data: {
            userId,
            shiftId,
            registrationType: RegistrationType.SELF,
            isConfirmed: false,
            confirmationToken,
          },
          include: {
            shift: { select: { date: true, shiftName: true, position: true, startTime: true } },
          },
        });
      },
      { timeout: 5000 },
    );
  }

  // ─── Volunteer Flexible Registration Preference ───

  getDefaultTargetMonth(date: Date = new Date()): string {
    let year = date.getFullYear();
    let month = date.getMonth(); // 0-indexed: 0-11
    const day = date.getDate();

    if (day >= 20) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  async getFlexiblePreference(userId: number, month?: string) {
    const targetMonth = month || this.getDefaultTargetMonth();
    const pref = await this.prisma.flexibleRegistrationPreference.findUnique({
      where: { userId_month: { userId, month: targetMonth } },
    });
    return {
      month: targetMonth,
      isFlexible: !!pref,
    };
  }

  async setFlexiblePreference(userId: number, month: string, isFlexible: boolean) {
    const isOpen = await this.systemConfig.isRegistrationOpen();
    if (!isOpen) {
      throw new ForbiddenException('Ngoài thời gian đăng ký ca trực');
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Định dạng tháng không hợp lệ (YYYY-MM)');
    }

    if (isFlexible) {
      await this.prisma.flexibleRegistrationPreference.upsert({
        where: { userId_month: { userId, month } },
        create: { userId, month },
        update: {},
      });
    } else {
      await this.prisma.flexibleRegistrationPreference.deleteMany({
        where: { userId, month },
      });
    }

    return {
      month,
      isFlexible,
    };
  }

  // ─── Auto-Fill Flexible Volunteers (Two-Phase Least-Chosen Allocation) ───

  async autoFillFlexibleShifts(month: string) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    // 1. Fetch all active volunteers with Flexible preference for this month
    const flexiblePrefs = await this.prisma.flexibleRegistrationPreference.findMany({
      where: { month },
      include: {
        user: {
          select: {
            id: true,
            ma_tnv: true,
            fullname: true,
            email: true,
            status: true,
            min_shifts_per_month: true,
          },
        },
      },
    });

    const activeVolunteers = flexiblePrefs
      .map((p) => p.user)
      .filter((u) => u.status === 'ACTIVE');

    if (activeVolunteers.length === 0) {
      return { assignedCount: 0, volunteerCount: 0, details: [] };
    }

    // 2. Fetch all active and published shifts for the month with current registrations
    const allShifts = await this.prisma.shiftInstance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        isActive: true,
        isPublished: true,
      },
      include: {
        registrations: {
          select: { id: true, userId: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // In-memory state tracking
    const shiftMap = new Map<
      number,
      {
        id: number;
        date: Date;
        shiftName: string;
        maxSlots: number;
        position: string;
        registeredUserIds: Set<number>;
      }
    >();

    for (const s of allShifts) {
      shiftMap.set(s.id, {
        id: s.id,
        date: s.date,
        shiftName: s.shiftName,
        maxSlots: s.maxSlots,
        position: s.position,
        registeredUserIds: new Set(s.registrations.map((r) => r.userId)),
      });
    }

    // User state tracking
    const userStateMap = new Map<
      number,
      {
        user: (typeof activeVolunteers)[0];
        currentShiftCount: number;
        assignedShiftIds: Set<number>;
        assignedTimeKeys: Set<string>;
        newlyAssignedShiftIds: number[];
      }
    >();

    for (const vol of activeVolunteers) {
      const userExistingRegs = await this.prisma.registration.findMany({
        where: {
          userId: vol.id,
          shift: { date: { gte: startDate, lte: endDate } },
        },
        include: {
          shift: { select: { id: true, date: true, shiftName: true } },
        },
      });

      const assignedShiftIds = new Set<number>();
      const assignedTimeKeys = new Set<string>();

      for (const reg of userExistingRegs) {
        assignedShiftIds.add(reg.shift.id);
        const dateStr = new Date(reg.shift.date).toISOString().split('T')[0];
        assignedTimeKeys.add(`${dateStr}_${reg.shift.shiftName}`);
      }

      userStateMap.set(vol.id, {
        user: vol,
        currentShiftCount: userExistingRegs.length,
        assignedShiftIds,
        assignedTimeKeys,
        newlyAssignedShiftIds: [],
      });
    }

    // Helper to find least chosen eligible shift for a volunteer
    const findBestShiftForUser = (userId: number): number | null => {
      const userState = userStateMap.get(userId);
      if (!userState) return null;

      const availableShifts = Array.from(shiftMap.values()).filter((shift) => {
        // Has available slot
        if (shift.registeredUserIds.size >= shift.maxSlots) return false;
        // User not already registered in this shift
        if (shift.registeredUserIds.has(userId) || userState.assignedShiftIds.has(shift.id)) return false;
        // No time conflict (same date and shiftName)
        const dateStr = new Date(shift.date).toISOString().split('T')[0];
        const timeKey = `${dateStr}_${shift.shiftName}`;
        if (userState.assignedTimeKeys.has(timeKey)) return false;

        return true;
      });

      // Helper to check if a shift is a night shift (Ca Tối)
      const isNightShift = (shiftName: string) => {
        const lower = shiftName.toLowerCase();
        return lower.includes('tối') || lower.includes('toi') || lower.includes('night');
      };

      // Sort candidate shifts:
      // 1. Prioritize shifts with fewest registrations (least-chosen first)
      // 2. If registration counts are equal, prioritize Night Shifts ("Ca Tối")
      // 3. Random tie-breaker
      availableShifts.sort((a, b) => {
        const countDiff = a.registeredUserIds.size - b.registeredUserIds.size;
        if (countDiff !== 0) return countDiff;

        const aIsNight = isNightShift(a.shiftName) ? 0 : 1;
        const bIsNight = isNightShift(b.shiftName) ? 0 : 1;
        if (aIsNight !== bIsNight) return aIsNight - bIsNight;

        return Math.random() - 0.5;
      });

      return availableShifts[0].id;
    };

    // Helper to assign a volunteer to a shift in memory
    const assignInMemory = (userId: number, shiftId: number) => {
      const userState = userStateMap.get(userId)!;
      const shift = shiftMap.get(shiftId)!;

      shift.registeredUserIds.add(userId);
      userState.assignedShiftIds.add(shiftId);
      const dateStr = new Date(shift.date).toISOString().split('T')[0];
      userState.assignedTimeKeys.add(`${dateStr}_${shift.shiftName}`);
      userState.currentShiftCount++;
      userState.newlyAssignedShiftIds.push(shiftId);
    };

    // ─── PHASE 1: Assign up to minimum KPI (min_shifts_per_month) ───
    const shuffledVolunteers = [...activeVolunteers].sort(() => Math.random() - 0.5);

    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;
      for (const vol of shuffledVolunteers) {
        const state = userStateMap.get(vol.id)!;
        if (state.currentShiftCount < vol.min_shifts_per_month) {
          const bestShiftId = findBestShiftForUser(vol.id);
          if (bestShiftId !== null) {
            assignInMemory(vol.id, bestShiftId);
            madeProgress = true;
          }
        }
      }
    }

    // ─── PHASE 2: If there are still empty / under-capacity shifts, assign more up to max 5 shifts/month ───
    const MAX_SHIFTS_PER_MONTH = 5;
    madeProgress = true;
    while (madeProgress) {
      madeProgress = false;

      const hasOpenShifts = Array.from(shiftMap.values()).some((s) => s.registeredUserIds.size < s.maxSlots);
      if (!hasOpenShifts) break;

      for (const vol of shuffledVolunteers) {
        const state = userStateMap.get(vol.id)!;
        if (state.currentShiftCount < MAX_SHIFTS_PER_MONTH) {
          const bestShiftId = findBestShiftForUser(vol.id);
          if (bestShiftId !== null) {
            assignInMemory(vol.id, bestShiftId);
            madeProgress = true;
          }
        }
      }
    }

    // ─── PERSIST ASSIGNMENTS TO DATABASE ───
    const newRegistrationsToCreate: {
      userId: number;
      shiftId: number;
      registrationType: RegistrationType;
      isConfirmed: boolean;
      confirmationToken: string;
    }[] = [];

    for (const [, state] of userStateMap) {
      for (const shiftId of state.newlyAssignedShiftIds) {
        newRegistrationsToCreate.push({
          userId: state.user.id,
          shiftId,
          registrationType: RegistrationType.AUTO_RANDOM,
          isConfirmed: false,
          confirmationToken: crypto.randomBytes(32).toString('hex'),
        });
      }
    }

    if (newRegistrationsToCreate.length > 0) {
      await this.prisma.$transaction(
        newRegistrationsToCreate.map((reg) =>
          this.prisma.registration.create({
            data: reg,
          }),
        ),
      );

      for (const [userId, state] of userStateMap) {
        if (state.newlyAssignedShiftIds.length > 0) {
          await this.prisma.notification.create({
            data: {
              userId,
              title: 'Lịch trực tự động đã được xếp',
              content: `Hệ thống đã tự động xếp bạn vào ${state.newlyAssignedShiftIds.length} ca trực trong tháng ${month} theo tùy chọn 'Lịch nào cũng được'. Vui lòng kiểm tra lịch cá nhân.`,
              type: 'INFO',
            },
          }).catch(() => {});
        }
      }
    }

    const details = Array.from(userStateMap.values()).map((s) => ({
      userId: s.user.id,
      ma_tnv: s.user.ma_tnv,
      fullname: s.user.fullname,
      addedShifts: s.newlyAssignedShiftIds.length,
      totalShifts: s.currentShiftCount,
    }));

    return {
      assignedCount: newRegistrationsToCreate.length,
      volunteerCount: activeVolunteers.length,
      details,
    };
  }

  // ─── Admin Bulk Assignment ───────────────────

  async adminAssign(adminId: number, shiftId: number, userId: number) {
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
    if (!shift.isActive) throw new ForbiddenException('Ca trực không hoạt động');

    const count = await this.prisma.registration.count({ where: { shiftId } });
    if (count >= shift.maxSlots) throw new ConflictException('Ca trực đã đầy');

    const existing = await this.prisma.registration.findUnique({
      where: { userId_shiftId: { userId, shiftId } },
    });
    if (existing) throw new ConflictException('TNV đã có trong ca trực này');

    await this.checkSameShiftConflict(this.prisma, userId, shiftId, shift.date, shift.shiftName);

    const confirmationToken = crypto.randomBytes(32).toString('hex');

    return this.prisma.registration.create({
      data: {
        userId,
        shiftId,
        registrationType: RegistrationType.BNS_ASSIGNED,
        isConfirmed: false,
        confirmationToken,
      },
    });
  }

  // ─── Cancel ─────────────────────────────────

  async cancel(userId: number, registrationId: number) {
    const reg = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { shift: true },
    });

    if (!reg) throw new NotFoundException('Không tìm thấy đăng ký');
    if (reg.userId !== userId) throw new ForbiddenException('Không có quyền hủy đăng ký này');

    const now = new Date();
    if (reg.shift.date < now) {
      throw new BadRequestException('Không thể hủy ca trực đã qua');
    }

    return this.prisma.registration.delete({ where: { id: registrationId } });
  }

  // ─── Email Confirmation via Token ───────────

  async confirmByToken(token: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { confirmationToken: token },
    });

    if (!registration) {
      throw new NotFoundException('Token xác nhận không hợp lệ hoặc đã hết hạn');
    }

    return this.prisma.registration.update({
      where: { id: registration.id },
      data: { isConfirmed: true, confirmationToken: null },
    });
  }

  // ─── Admin Confirmation ──────────────────────

  async confirmByAdmin(registrationId: number) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) throw new NotFoundException('Không tìm thấy đăng ký');

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: { isConfirmed: true, confirmationToken: null },
    });
  }

  async confirmAllByShift(shiftId: number) {
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');

    const result = await this.prisma.registration.updateMany({
      where: { shiftId, isConfirmed: false },
      data: { isConfirmed: true, confirmationToken: null },
    });

    return { confirmed: result.count, shiftId };
  }

  async confirmAllForMonth(month: string) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    const result = await this.prisma.registration.updateMany({
      where: {
        isConfirmed: false,
        shift: { date: { gte: startDate, lte: endDate } },
      },
      data: { isConfirmed: true, confirmationToken: null },
    });

    return { confirmed: result.count, month };
  }

  async unconfirmByAdmin(registrationId: number) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) throw new NotFoundException('Không tìm thấy đăng ký');

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: { isConfirmed: false },
    });
  }

  async unconfirmAllByShift(shiftId: number) {
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');

    const result = await this.prisma.registration.updateMany({
      where: { shiftId, isConfirmed: true },
      data: { isConfirmed: false },
    });

    return { unconfirmed: result.count, shiftId };
  }

  async unconfirmAllForMonth(month: string) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    const result = await this.prisma.registration.updateMany({
      where: {
        isConfirmed: true,
        shift: { date: { gte: startDate, lte: endDate } },
      },
      data: { isConfirmed: false },
    });

    return { unconfirmed: result.count, month };
  }

  async cancelByAdmin(registrationId: number) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });
    if (!registration) throw new NotFoundException('Không tìm thấy đăng ký');
    return this.prisma.registration.delete({ where: { id: registrationId } });
  }

  isOpen() {
    return this.systemConfig.isRegistrationOpen();
  }

  private async checkSameShiftConflict(
    client: any,
    userId: number,
    targetShiftId: number,
    targetDate: Date,
    targetShiftName: string,
  ): Promise<void> {
    const conflict = await client.registration.findFirst({
      where: {
        userId,
        shiftId: { not: targetShiftId },
        shift: { date: targetDate, shiftName: targetShiftName },
      },
    });
    if (conflict) {
      throw new ConflictException('Bạn đã có ca trực cùng thời gian tại địa điểm khác');
    }
  }

  // ─── Queries ────────────────────────────────

  findMyRegistrations(userId: number, upcoming: boolean) {
    const now = new Date();
    return this.prisma.registration.findMany({
      where: {
        userId,
        shift: upcoming ? { date: { gte: now } } : { date: { lt: now } },
      },
      include: {
        shift: true,
      },
      orderBy: { shift: { date: upcoming ? 'asc' : 'desc' } },
    });
  }

  findByShift(shiftId: number) {
    return this.prisma.registration.findMany({
      where: { shiftId },
      include: {
        user: { select: { id: true, ma_tnv: true, fullname: true } },
      },
    });
  }
}
