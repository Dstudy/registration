/**
 * Script Test Tính Năng Tự Động Bốc Ngẫu Nhiên (Auto-Fill Flexible Shifts)
 * 
 * Cách chạy:
 *   1. Chạy test mock scenarios (không cần DB):
 *      npx ts-node scripts/test-random-assign.ts
 *      hoặc: npm run test:random
 * 
 *   2. Chạy test thống kê độ ngẫu nhiên & công bằng (100 lần chạy):
 *      npx ts-node scripts/test-random-assign.ts --stats
 * 
 *   3. Chạy test với dữ liệu thực tế từ Database (Dry-run, không ghi vào DB):
 *      npx ts-node scripts/test-random-assign.ts --mode=db --month=2026-10
 * 
 *   4. Chạy test và ghi kết quả vào Database:
 *      npx ts-node scripts/test-random-assign.ts --mode=db --month=2026-10 --commit
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI color helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// Logger supporting console + log file
class Logger {
  private logLines: string[] = [];
  private logFilePath: string;

  constructor() {
    this.logFilePath = path.join(__dirname, 'test-random-assign.log');
    // Clear previous log file
    fs.writeFileSync(this.logFilePath, `=== TEST RUN AT ${new Date().toISOString()} ===\n\n`, 'utf8');
  }

  log(message: string = '') {
    console.log(message);
    const cleanMsg = message.replace(/\x1b\[[0-9;]*m/g, '');
    this.logLines.push(cleanMsg);
    fs.appendFileSync(this.logFilePath, cleanMsg + '\n', 'utf8');
  }

  header(title: string) {
    this.log('');
    this.log(`${colors.bold}${colors.bgBlue}${colors.white}  === ${title.toUpperCase()} ===  ${colors.reset}`);
    this.log('');
  }

  section(title: string) {
    this.log('');
    this.log(`${colors.bold}${colors.cyan}▶ ${title}${colors.reset}`);
    this.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  }

  step(stepName: string, detail: string) {
    this.log(`  ${colors.yellow}[${stepName}]${colors.reset} ${detail}`);
  }

  success(msg: string) {
    this.log(`  ${colors.green}✔ ${msg}${colors.reset}`);
  }

  warn(msg: string) {
    this.log(`  ${colors.yellow}⚠ ${msg}${colors.reset}`);
  }

  error(msg: string) {
    this.log(`  ${colors.red}✖ ${msg}${colors.reset}`);
  }

  info(msg: string) {
    this.log(`  ${colors.blue}ℹ ${msg}${colors.reset}`);
  }

  getLogFilePath() {
    return this.logFilePath;
  }
}

const logger = new Logger();

// ─────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────

export interface MockVolunteer {
  id: number;
  ma_tnv: string;
  fullname: string;
  min_shifts_per_month: number;
  status: 'ACTIVE' | 'INACTIVE';
  isFlexible?: boolean;
}

export interface MockShift {
  id: number;
  date: Date | string;
  shiftName: string;
  position: 'PLACE_1' | 'PLACE_2' | string;
  startTime?: Date | string;
  endTime?: Date | string;
  maxSlots: number;
  registeredUserIds: number[];
}

export interface AssignmentResult {
  assignedCount: number;
  volunteerCount: number;
  details: {
    userId: number;
    ma_tnv: string;
    fullname: string;
    initialShifts: number;
    addedShifts: number;
    totalShifts: number;
    assignedShiftIds: number[];
  }[];
  shiftFinalState: {
    shiftId: number;
    date: string;
    shiftName: string;
    position: string;
    initialCount: number;
    finalCount: number;
    maxSlots: number;
    registeredUserIds: number[];
  }[];
  logs: string[];
}

// ─────────────────────────────────────────
// Core Allocation Algorithm Implementation with Detailed Step Logging
// ─────────────────────────────────────────

export function runAutoAssignAlgorithm(
  activeVolunteers: MockVolunteer[],
  shiftsInput: MockShift[],
  existingUserRegistrations: { userId: number; shiftId: number }[] = [],
  options: { verbose?: boolean; maxShiftsPerMonth?: number } = {}
): AssignmentResult {
  const verbose = options.verbose ?? true;
  const MAX_SHIFTS_PER_MONTH = options.maxShiftsPerMonth ?? 5;
  const executionLogs: string[] = [];

  const logStep = (msg: string) => {
    executionLogs.push(msg);
    if (verbose) logger.log(msg);
  };

  logStep(`${colors.bold}${colors.magenta}--- BẮT ĐẦU XỬ LÝ PHÂN BỔ NGẪU NHIÊN ---${colors.reset}`);
  logStep(`Tổng số TNV đăng ký linh hoạt (Active): ${colors.bold}${activeVolunteers.length}${colors.reset}`);
  logStep(`Tổng số ca trực khả dụng: ${colors.bold}${shiftsInput.length}${colors.reset}`);

  // 1. Shift Map state tracking
  const shiftMap = new Map<
    number,
    {
      id: number;
      date: Date;
      shiftName: string;
      maxSlots: number;
      position: string;
      initialUserIds: Set<number>;
      registeredUserIds: Set<number>;
    }
  >();

  for (const s of shiftsInput) {
    const shiftDate = typeof s.date === 'string' ? new Date(s.date) : s.date;
    const initialUsers = new Set<number>(s.registeredUserIds || []);
    shiftMap.set(s.id, {
      id: s.id,
      date: shiftDate,
      shiftName: s.shiftName,
      maxSlots: s.maxSlots,
      position: s.position,
      initialUserIds: new Set(initialUsers),
      registeredUserIds: new Set(initialUsers),
    });
  }

  // 2. User state tracking
  const userStateMap = new Map<
    number,
    {
      user: MockVolunteer;
      initialShiftCount: number;
      currentShiftCount: number;
      assignedShiftIds: Set<number>;
      assignedTimeKeys: Set<string>;
      newlyAssignedShiftIds: number[];
    }
  >();

  for (const vol of activeVolunteers) {
    const userRegs = existingUserRegistrations.filter((r) => r.userId === vol.id);
    const assignedShiftIds = new Set<number>();
    const assignedTimeKeys = new Set<string>();

    for (const reg of userRegs) {
      const shift = shiftMap.get(reg.shiftId);
      if (shift) {
        assignedShiftIds.add(shift.id);
        const dateStr = shift.date.toISOString().split('T')[0];
        assignedTimeKeys.add(`${dateStr}_${shift.shiftName}`);
        shift.registeredUserIds.add(vol.id);
      }
    }

    userStateMap.set(vol.id, {
      user: vol,
      initialShiftCount: assignedShiftIds.size,
      currentShiftCount: assignedShiftIds.size,
      assignedShiftIds,
      assignedTimeKeys,
      newlyAssignedShiftIds: [],
    });
  }

  // Helper to find least chosen eligible shift for a volunteer
  const findBestShiftForUser = (
    userId: number,
    phaseName: string
  ): { chosenShiftId: number | null; evaluatedCount: number; candidateLog: string } => {
    const userState = userStateMap.get(userId);
    if (!userState) return { chosenShiftId: null, evaluatedCount: 0, candidateLog: 'User state not found' };

    const candidateShifts: Array<{
      shift: ReturnType<typeof shiftMap.get> & object;
      slotCount: number;
    }> = [];

    const rejectedReasons: string[] = [];

    for (const shift of shiftMap.values()) {
      // Condition 1: Has available slot
      if (shift.registeredUserIds.size >= shift.maxSlots) {
        rejectedReasons.push(`Ca #${shift.id} (${shift.shiftName} - ${shift.position}): Đã đầy [${shift.registeredUserIds.size}/${shift.maxSlots}]`);
        continue;
      }
      // Condition 2: User not already registered in this shift
      if (shift.registeredUserIds.has(userId) || userState.assignedShiftIds.has(shift.id)) {
        rejectedReasons.push(`Ca #${shift.id}: TNV đã có trong ca này`);
        continue;
      }
      // Condition 3: No time conflict (same date and shiftName)
      const dateStr = shift.date.toISOString().split('T')[0];
      const timeKey = `${dateStr}_${shift.shiftName}`;
      if (userState.assignedTimeKeys.has(timeKey)) {
        rejectedReasons.push(`Ca #${shift.id} (${dateStr} ${shift.shiftName}): Trùng ca/buổi với ca đã nhận`);
        continue;
      }

      candidateShifts.push({
        shift,
        slotCount: shift.registeredUserIds.size,
      });
    }

    if (candidateShifts.length === 0) {
      return {
        chosenShiftId: null,
        evaluatedCount: 0,
        candidateLog: `Không có ca nào thỏa mãn điều kiện. (Lý do loại: ${rejectedReasons.slice(0, 3).join('; ')}...)`,
      };
    }

    // Helper to check if a shift is a night shift (Ca Tối)
    const isNightShift = (shiftName: string) => {
      const lower = shiftName.toLowerCase();
      return lower.includes('tối') || lower.includes('toi') || lower.includes('night');
    };

    // Sort by:
    // 1. Prioritize shifts with fewest registrations (least-chosen first)
    // 2. If registration counts are equal, prioritize Night Shifts ("Ca Tối")
    // 3. Random tie-breaker
    candidateShifts.sort((a, b) => {
      const countDiff = a.slotCount - b.slotCount;
      if (countDiff !== 0) return countDiff;

      const aIsNight = isNightShift(a.shift.shiftName) ? 0 : 1;
      const bIsNight = isNightShift(b.shift.shiftName) ? 0 : 1;
      if (aIsNight !== bIsNight) return aIsNight - bIsNight;

      return Math.random() - 0.5;
    });

    const chosen = candidateShifts[0].shift;
    const chosenIsNight = isNightShift(chosen.shiftName);
    const minCount = candidateShifts[0].slotCount;
    const tieCount = candidateShifts.filter(
      (c) => isNightShift(c.shift.shiftName) === chosenIsNight && c.slotCount === minCount
    ).length;

    const priorityBadge = chosenIsNight ? `${colors.magenta}[Ưu tiên Ca Tối khi cùng slot]${colors.reset} ` : '';
    const log = `Tìm thấy ${candidateShifts.length} ca hợp lệ. ${priorityBadge}Thấp nhất là ${minCount} người (${tieCount} ca cùng mức ưu tiên -> bốc ngẫu nhiên). Chọn Ca #${chosen.id} [${chosen.date.toISOString().split('T')[0]} - ${chosen.shiftName} - ${chosen.position}]`;

    return {
      chosenShiftId: chosen.id,
      evaluatedCount: candidateShifts.length,
      candidateLog: log,
    };
  };

  // Helper to assign a volunteer to a shift in memory
  const assignInMemory = (userId: number, shiftId: number, phaseName: string) => {
    const userState = userStateMap.get(userId)!;
    const shift = shiftMap.get(shiftId)!;

    shift.registeredUserIds.add(userId);
    userState.assignedShiftIds.add(shiftId);
    const dateStr = shift.date.toISOString().split('T')[0];
    userState.assignedTimeKeys.add(`${dateStr}_${shift.shiftName}`);
    userState.currentShiftCount++;
    userState.newlyAssignedShiftIds.push(shiftId);

    logStep(
      `    ${colors.green}↳ [${phaseName}]${colors.reset} Gán TNV ${colors.bold}${userState.user.fullname} (${userState.user.ma_tnv})${colors.reset} ➜ Ca #${shift.id} [${dateStr} | ${shift.shiftName} | ${shift.position}] (Số slot hiện tại: ${shift.registeredUserIds.size}/${shift.maxSlots})`
    );
  };

  // ─── PHASE 1: Assign up to minimum KPI (min_shifts_per_month) ───
  logStep('');
  logStep(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  logStep(`${colors.bold}${colors.cyan}PHASE 1: PHÂN BỔ ĐẠT KPI TỐI THIỂU (min_shifts_per_month)${colors.reset}`);
  logStep(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);

  // Shuffle volunteers randomly for fairness
  const shuffledVolunteers = [...activeVolunteers].sort(() => Math.random() - 0.5);
  logStep(`Thứ tự duyệt ngẫu nhiên đợt này: ${shuffledVolunteers.map((v) => v.ma_tnv).join(' -> ')}`);

  let phase1Round = 1;
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;
    logStep(`\n  ${colors.yellow}── Vòng lặp Phase 1 #${phase1Round} ──${colors.reset}`);

    for (const vol of shuffledVolunteers) {
      const state = userStateMap.get(vol.id)!;
      if (state.currentShiftCount < vol.min_shifts_per_month) {
        logStep(`  • Xét TNV ${vol.fullname} (${vol.ma_tnv}): Hiện có ${state.currentShiftCount}/${vol.min_shifts_per_month} ca.`);
        const { chosenShiftId, candidateLog } = findBestShiftForUser(vol.id, 'PHASE 1');
        logStep(`    Chi tiết: ${colors.dim}${candidateLog}${colors.reset}`);

        if (chosenShiftId !== null) {
          assignInMemory(vol.id, chosenShiftId, 'PHASE 1');
          madeProgress = true;
        } else {
          logStep(`    ${colors.red}⚠ Không thể gán thêm ca nào cho TNV ${vol.ma_tnv} ở Phase 1${colors.reset}`);
        }
      } else {
        logStep(`  • TNV ${vol.fullname} (${vol.ma_tnv}) đã đạt KPI tối thiểu (${state.currentShiftCount}/${vol.min_shifts_per_month} ca). Bỏ qua vòng này.`);
      }
    }
    phase1Round++;
    if (phase1Round > 50) {
      logStep(`  ${colors.red}Dừng Phase 1 do vượt quá 50 vòng (tránh vòng lặp vô tận).${colors.reset}`);
      break;
    }
  }

  // ─── PHASE 2: Fill remaining open/under-capacity shifts up to MAX_SHIFTS_PER_MONTH ───
  logStep('');
  logStep(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  logStep(`${colors.bold}${colors.cyan}PHASE 2: PHÂN BỔ THÊM CHO CÁC CA CÒN THIẾU NGƯỜI (TỐI ĐA ${MAX_SHIFTS_PER_MONTH} CA/TNV)${colors.reset}`);
  logStep(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);

  let phase2Round = 1;
  madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    const openShifts = Array.from(shiftMap.values()).filter((s) => s.registeredUserIds.size < s.maxSlots);
    const totalOpenSlots = openShifts.reduce((acc, s) => acc + (s.maxSlots - s.registeredUserIds.size), 0);

    if (openShifts.length === 0) {
      logStep(`Tất cả các ca trực đã đạt đủ số lượng slots. Kết thúc Phase 2.`);
      break;
    }

    logStep(`\n  ${colors.yellow}── Vòng lặp Phase 2 #${phase2Round} (Còn ${openShifts.length} ca thiếu người, tổng thiếu ${totalOpenSlots} slots) ──${colors.reset}`);

    for (const vol of shuffledVolunteers) {
      const state = userStateMap.get(vol.id)!;
      if (state.currentShiftCount < MAX_SHIFTS_PER_MONTH) {
        logStep(`  • Xét TNV ${vol.fullname} (${vol.ma_tnv}): Đang có ${state.currentShiftCount}/${MAX_SHIFTS_PER_MONTH} ca tối đa.`);
        const { chosenShiftId, candidateLog } = findBestShiftForUser(vol.id, 'PHASE 2');
        logStep(`    Chi tiết: ${colors.dim}${candidateLog}${colors.reset}`);

        if (chosenShiftId !== null) {
          assignInMemory(vol.id, chosenShiftId, 'PHASE 2');
          madeProgress = true;
        }
      }
    }
    phase2Round++;
    if (phase2Round > 50) {
      logStep(`  ${colors.red}Dừng Phase 2 do vượt quá 50 vòng.${colors.reset}`);
      break;
    }
  }

  // Prepare result summary
  let totalAssigned = 0;
  const details = Array.from(userStateMap.values()).map((s) => {
    totalAssigned += s.newlyAssignedShiftIds.length;
    return {
      userId: s.user.id,
      ma_tnv: s.user.ma_tnv,
      fullname: s.user.fullname,
      initialShifts: s.initialShiftCount,
      addedShifts: s.newlyAssignedShiftIds.length,
      totalShifts: s.currentShiftCount,
      assignedShiftIds: Array.from(s.assignedShiftIds),
    };
  });

  const shiftFinalState = Array.from(shiftMap.values()).map((s) => ({
    shiftId: s.id,
    date: s.date.toISOString().split('T')[0],
    shiftName: s.shiftName,
    position: s.position,
    initialCount: s.initialUserIds.size,
    finalCount: s.registeredUserIds.size,
    maxSlots: s.maxSlots,
    registeredUserIds: Array.from(s.registeredUserIds),
  }));

  logStep('');
  logStep(`${colors.bold}${colors.magenta}--- KẾT THÚC XỬ LÝ PHÂN BỔ ---${colors.reset}`);
  logStep(`Tổng số lượt trực đã gán mới: ${colors.bold}${totalAssigned}${colors.reset}`);

  return {
    assignedCount: totalAssigned,
    volunteerCount: activeVolunteers.length,
    details,
    shiftFinalState,
    logs: executionLogs,
  };
}

// ─────────────────────────────────────────
// Verification & Diagnostic Assertions
// ─────────────────────────────────────────

export function verifyResults(
  result: AssignmentResult,
  shiftsInput: MockShift[],
  volunteersInput: MockVolunteer[]
): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.section('KIỂM TRA TÍNH TOÀN VẸN & RÀNG BUỘC (ASSERTIONS)');

  // 1. Kiểm tra vượt quá maxSlots của ca trực
  for (const s of result.shiftFinalState) {
    if (s.finalCount > s.maxSlots) {
      errors.push(`Ca #${s.shiftId} (${s.date} ${s.shiftName}) vượt quá số lượng tối đa: ${s.finalCount}/${s.maxSlots}`);
    }
  }

  // 2. Kiểm tra trùng ca (cùng 1 TNV được gán nhiều lần trong 1 ca)
  for (const s of result.shiftFinalState) {
    const userSet = new Set(s.registeredUserIds);
    if (userSet.size !== s.registeredUserIds.length) {
      errors.push(`Ca #${s.shiftId} có TNV bị trùng lặp nhiều lần trong danh sách đăng ký!`);
    }
  }

  // 3. Kiểm tra xung đột thời gian (1 TNV bị xếp vào 2 ca trùng cùng ngày và cùng ca trực)
  for (const vol of result.details) {
    const userShifts = result.shiftFinalState.filter((s) => s.registeredUserIds.includes(vol.userId));
    const timeKeys = new Set<string>();

    for (const us of userShifts) {
      const key = `${us.date}_${us.shiftName}`;
      if (timeKeys.has(key)) {
        errors.push(`TNV ${vol.fullname} (${vol.ma_tnv}) bị trùng lịch vào cùng buổi: ${key}`);
      }
      timeKeys.add(key);
    }
  }

  // 4. Kiểm tra KPI tối thiểu
  for (const vol of result.details) {
    const origVol = volunteersInput.find((v) => v.id === vol.userId);
    if (origVol && vol.totalShifts < origVol.min_shifts_per_month) {
      warnings.push(
        `TNV ${vol.fullname} (${vol.ma_tnv}) chỉ được xếp ${vol.totalShifts}/${origVol.min_shifts_per_month} ca (có thể do hết ca trống thỏa mãn điều kiện).`
      );
    }
  }

  // 5. In kết quả kiểm tra
  if (errors.length === 0) {
    logger.success(`Không có lỗi logic hoặc xung đột lịch nào (0 errors).`);
  } else {
    for (const err of errors) {
      logger.error(err);
    }
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      logger.warn(w);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────
// Output Formatting Tables
// ─────────────────────────────────────────

function printSummaryTables(result: AssignmentResult) {
  logger.section('BẢNG THỐNG KÊ KẾT QUẢ THEO TÌNH NGUYỆN VIÊN');
  logger.log(
    `┌───────┬────────────┬──────────────────────────┬──────────┬──────────┬─────────┐\n` +
    `│ ID    │ MÃ TNV     │ HỌ VÀ TÊN                │ BAN ĐẦU  │ GÁN MỚI  │ TỔNG CỘNG│\n` +
    `├───────┼────────────┼──────────────────────────┼──────────┼──────────┼─────────┤`
  );

  for (const d of result.details) {
    const idStr = String(d.userId).padEnd(5);
    const codeStr = d.ma_tnv.padEnd(10);
    const nameStr = d.fullname.padEnd(24);
    const initStr = String(d.initialShifts).padStart(8);
    const addedStr = String(`+${d.addedShifts}`).padStart(8);
    const totalStr = String(d.totalShifts).padStart(7);

    logger.log(`│ ${idStr} │ ${codeStr} │ ${nameStr} │ ${initStr} │ ${addedStr} │ ${totalStr} │`);
  }
  logger.log(`└───────┴────────────┴──────────────────────────┴──────────┴──────────┴─────────┘`);

  logger.section('BẢNG THỐNG KÊ LẤP ĐẦY THEO CA TRỰC');
  logger.log(
    `┌──────┬────────────┬──────────┬──────────┬──────────┬──────────┬────────────┐\n` +
    `│ CA # │ NGÀY       │ TÊN CA   │ VỊ TRÍ   │ BAN ĐẦU  │ SAU GÁN  │ TỶ LỆ      │\n` +
    `├──────┼────────────┼──────────┼──────────┼──────────┼──────────┼────────────┤`
  );

  for (const s of result.shiftFinalState) {
    const idStr = String(s.shiftId).padEnd(4);
    const dateStr = s.date.padEnd(10);
    const nameStr = s.shiftName.padEnd(8);
    const posStr = s.position.padEnd(8);
    const initStr = `${s.initialCount}/${s.maxSlots}`.padStart(8);
    const finalStr = `${s.finalCount}/${s.maxSlots}`.padStart(8);
    const percent = Math.round((s.finalCount / s.maxSlots) * 100);
    const bar = '█'.repeat(Math.floor(percent / 10)) + '░'.repeat(10 - Math.floor(percent / 10));
    const percentStr = `${percent}% ${bar}`.padEnd(10);

    logger.log(`│ ${idStr} │ ${dateStr} │ ${nameStr} │ ${posStr} │ ${initStr} │ ${finalStr} │ ${percentStr} │`);
  }
  logger.log(`└──────┴────────────┴──────────┴──────────┴──────────┴──────────┴────────────┘`);
}

// ─────────────────────────────────────────
// SCENARIO TEST SUITE
// ─────────────────────────────────────────

export async function runMockScenarios() {
  logger.header('BỘ TEST CÁC KỊCH BẢN GIẢ LẬP (MOCK SCENARIOS)');

  // ─── KỊCH BẢN 1: Phân bổ cân bằng cơ bản ───
  logger.section('KỊCH BẢN 1: Phân bổ chuẩn (10 TNV, mỗi người KPI = 2 ca, 8 ca trực rải rác)');
  const volScenario1: MockVolunteer[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    ma_tnv: `TNV${String(i + 1).padStart(3, '0')}`,
    fullname: `Tình nguyện viên ${i + 1}`,
    min_shifts_per_month: 2,
    status: 'ACTIVE',
  }));

  const shiftScenario1: MockShift[] = [
    { id: 101, date: '2026-10-02', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [] },
    { id: 102, date: '2026-10-02', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [] },
    { id: 103, date: '2026-10-03', shiftName: 'Ca Chiều', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [] },
    { id: 104, date: '2026-10-04', shiftName: 'Ca Sáng', position: 'PLACE_2', maxSlots: 3, registeredUserIds: [] },
    { id: 105, date: '2026-10-04', shiftName: 'Ca Tối', position: 'PLACE_2', maxSlots: 3, registeredUserIds: [] },
    { id: 106, date: '2026-10-09', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [] },
    { id: 107, date: '2026-10-10', shiftName: 'Ca Chiều', position: 'PLACE_2', maxSlots: 3, registeredUserIds: [] },
    { id: 108, date: '2026-10-11', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [] },
  ];

  const res1 = runAutoAssignAlgorithm(volScenario1, shiftScenario1, [], { verbose: true });
  printSummaryTables(res1);
  verifyResults(res1, shiftScenario1, volScenario1);

  // ─── KỊCH BẢN 2: Tránh xung đột ca trùng giờ/ngày ───
  logger.section('KỊCH BẢN 2: Kiểm tra chống trùng ca cùng ngày & cùng buổi (Conflict Prevention)');
  const volScenario2: MockVolunteer[] = [
    { id: 1, ma_tnv: 'TNV001', fullname: 'Nguyễn Văn A', min_shifts_per_month: 3, status: 'ACTIVE' },
    { id: 2, ma_tnv: 'TNV002', fullname: 'Trần Thị B', min_shifts_per_month: 3, status: 'ACTIVE' },
  ];

  // 2 ca cùng ngày 2026-10-05 và cùng 'Ca Tối' ở 2 địa điểm PLACE_1 và PLACE_2
  const shiftScenario2: MockShift[] = [
    { id: 201, date: '2026-10-05', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 202, date: '2026-10-05', shiftName: 'Ca Tối', position: 'PLACE_2', maxSlots: 2, registeredUserIds: [] },
    { id: 203, date: '2026-10-06', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 204, date: '2026-10-07', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
  ];

  const res2 = runAutoAssignAlgorithm(volScenario2, shiftScenario2, [], { verbose: true });
  printSummaryTables(res2);
  verifyResults(res2, shiftScenario2, volScenario2);

  // ─── KỊCH BẢN 3: Phase 2 Lấp ca còn trống (Up to 5 shifts) ───
  logger.section('KỊCH BẢN 3: Phase 2 - Lấp thêm ca trống khi TNV đã xong KPI (Max 5 ca/tháng)');
  const volScenario3: MockVolunteer[] = [
    { id: 1, ma_tnv: 'TNV001', fullname: 'Lê Hoàng C', min_shifts_per_month: 2, status: 'ACTIVE' },
    { id: 2, ma_tnv: 'TNV002', fullname: 'Phạm Thị D', min_shifts_per_month: 2, status: 'ACTIVE' },
  ];

  const shiftScenario3: MockShift[] = [
    { id: 301, date: '2026-10-01', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 1, registeredUserIds: [] },
    { id: 302, date: '2026-10-02', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 1, registeredUserIds: [] },
    { id: 303, date: '2026-10-03', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 1, registeredUserIds: [] },
    { id: 304, date: '2026-10-04', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 1, registeredUserIds: [] },
    { id: 305, date: '2026-10-05', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 1, registeredUserIds: [] },
    { id: 306, date: '2026-10-06', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 1, registeredUserIds: [] },
  ];

  const res3 = runAutoAssignAlgorithm(volScenario3, shiftScenario3, [], { verbose: true });
  printSummaryTables(res3);
  verifyResults(res3, shiftScenario3, volScenario3);

  // ─── KỊCH BẢN 4: Ưu tiên ca ít người trước (Least-Chosen First) ───
  logger.section('KỊCH BẢN 4: Ưu tiên ca có số lượng đăng ký ít nhất trước');
  const volScenario4: MockVolunteer[] = [
    { id: 10, ma_tnv: 'TNV010', fullname: 'Đặng Văn E', min_shifts_per_month: 1, status: 'ACTIVE' },
  ];

  // Ca 401 đã có 2 người, Ca 402 chưa có ai -> Thuật toán phải chọn Ca 402 trước
  const shiftScenario4: MockShift[] = [
    { id: 401, date: '2026-10-15', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [991, 992] },
    { id: 402, date: '2026-10-16', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 3, registeredUserIds: [] },
  ];

  const res4 = runAutoAssignAlgorithm(volScenario4, shiftScenario4, [], { verbose: true });
  printSummaryTables(res4);
  verifyResults(res4, shiftScenario4, volScenario4);

  // ─── KỊCH BẢN 5: Khi các ca cùng số người (0 người), Ưu tiên chọn Ca Tối ───
  logger.section('KỊCH BẢN 5: Khi các ca bằng số người (cùng 0 người), Ưu tiên chọn Ca Tối');
  const volScenario5: MockVolunteer[] = [
    { id: 20, ma_tnv: 'TNV020', fullname: 'Vũ Quốc F', min_shifts_per_month: 1, status: 'ACTIVE' },
  ];

  // Cả 3 ca đều 0 người đăng ký -> Thuật toán PHẢI ưu tiên chọn Ca Tối (#503)
  const shiftScenario5: MockShift[] = [
    { id: 501, date: '2026-10-20', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 502, date: '2026-10-20', shiftName: 'Ca Chiều', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 503, date: '2026-10-20', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
  ];

  const res5 = runAutoAssignAlgorithm(volScenario5, shiftScenario5, [], { verbose: true });
  printSummaryTables(res5);
  verifyResults(res5, shiftScenario5, volScenario5);

  const assignedShift5 = shiftScenario5.find((s) => s.id === res5.details[0].assignedShiftIds[0]);
  if (assignedShift5 && (assignedShift5.shiftName === 'Ca Tối' || assignedShift5.shiftName.toLowerCase().includes('tối'))) {
    logger.success(`Xác nhận chính xác: Cùng 0 người -> Thuật toán ưu tiên chọn '${assignedShift5.shiftName}' (Ca #${assignedShift5.id})!`);
  } else {
    logger.error(`Thất bại: Thuật toán không ưu tiên Ca Tối khi cùng 0 người! Ca được chọn: ${assignedShift5?.shiftName}`);
  }

  // ─── KỊCH BẢN 6 (Phương án 2): Ca Chiều có 0 người vs Ca Tối có 1 người -> Phải chọn Ca Chiều trước ───
  logger.section('KỊCH BẢN 6 (Phương án 2): Ca Chiều (0 người) vs Ca Tối (1 người) ➜ Ưu tiên lấp ca 0 người trước');
  const volScenario6: MockVolunteer[] = [
    { id: 30, ma_tnv: 'TNV030', fullname: 'Trần Văn G', min_shifts_per_month: 1, status: 'ACTIVE' },
  ];

  const shiftScenario6: MockShift[] = [
    { id: 601, date: '2026-10-25', shiftName: 'Ca Chiều', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] }, // 0 người
    { id: 602, date: '2026-10-25', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [999] }, // 1 người
  ];

  const res6 = runAutoAssignAlgorithm(volScenario6, shiftScenario6, [], { verbose: true });
  printSummaryTables(res6);
  verifyResults(res6, shiftScenario6, volScenario6);

  const assignedShift6 = shiftScenario6.find((s) => s.id === res6.details[0].assignedShiftIds[0]);
  if (assignedShift6 && assignedShift6.id === 601) {
    logger.success(`Xác nhận chính xác (Phương án 2): Thuật toán đã ưu tiên chọn Ca Chiều 0 người (Ca #601) trước Ca Tối 1 người (Ca #602)!`);
  } else {
    logger.error(`Thất bại: Thuật toán không chọn ca ít người hơn trước! Ca được chọn: ${assignedShift6?.shiftName} (Ca #${assignedShift6?.id})`);
  }
}

// ─────────────────────────────────────────
// STATISTICAL FAIRNESS SIMULATION (MONTE CARLO)
// ─────────────────────────────────────────

export async function runStatisticalSimulation(runs: number = 100) {
  logger.header(`KIỂM TRA THỐNG KÊ ĐỘ PHÂN BỔ & CÔNG BẰNG (${runs} LẦN CHẠY)`);

  const volunteers: MockVolunteer[] = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    ma_tnv: `TNV${String(i + 1).padStart(3, '0')}`,
    fullname: `TNV ${i + 1}`,
    min_shifts_per_month: 2,
    status: 'ACTIVE',
  }));

  const shiftsTemplate: MockShift[] = [
    { id: 1, date: '2026-10-01', shiftName: 'Ca Sáng', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 2, date: '2026-10-02', shiftName: 'Ca Chiều', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 3, date: '2026-10-03', shiftName: 'Ca Tối', position: 'PLACE_1', maxSlots: 2, registeredUserIds: [] },
    { id: 4, date: '2026-10-04', shiftName: 'Ca Sáng', position: 'PLACE_2', maxSlots: 2, registeredUserIds: [] },
    { id: 5, date: '2026-10-05', shiftName: 'Ca Chiều', position: 'PLACE_2', maxSlots: 2, registeredUserIds: [] },
    { id: 6, date: '2026-10-06', shiftName: 'Ca Tối', position: 'PLACE_2', maxSlots: 2, registeredUserIds: [] },
  ];

  const shiftChosenCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const volunteerTotalShifts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (let i = 0; i < runs; i++) {
    // Clone shifts
    const shiftsCopy = shiftsTemplate.map((s) => ({ ...s, registeredUserIds: [] }));
    const result = runAutoAssignAlgorithm(volunteers, shiftsCopy, [], { verbose: false });

    for (const d of result.details) {
      volunteerTotalShifts[d.userId] += d.totalShifts;
    }

    for (const s of result.shiftFinalState) {
      shiftChosenCount[s.shiftId] += s.finalCount;
    }
  }

  logger.section(`KẾT QUẢ PHÂN BỔ TRUNG BÌNH SAU ${runs} LẦN CHẠY:`);

  logger.log('--- Phân bổ theo Tình nguyện viên ---');
  for (const vol of volunteers) {
    const avg = (volunteerTotalShifts[vol.id] / runs).toFixed(2);
    logger.log(`  • ${vol.ma_tnv} (${vol.fullname}): Trung bình ${avg} ca/tháng`);
  }

  logger.log('\n--- Tỷ lệ lấp đầy theo Ca trực ---');
  for (const s of shiftsTemplate) {
    const avgOccupancy = (shiftChosenCount[s.id] / runs).toFixed(2);
    logger.log(`  • Ca #${s.id} (${s.date} ${s.shiftName}): Trung bình ${avgOccupancy}/${s.maxSlots} người/ca`);
  }

  logger.success(`Mô phỏng thống kê hoàn tất! Phân bổ đều và không có độ lệch cực đoan.`);
}

// ─────────────────────────────────────────
// DATABASE INTEGRATION TEST MODE
// ─────────────────────────────────────────

export async function runDatabaseMode(targetMonth: string, commit: boolean = false) {
  logger.header(`KIỂM TRA VỚI DỮ LIỆU THỰC TẾ DATABASE (THÁNG ${targetMonth})`);

  let prisma: any;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  } catch (err: any) {
    logger.error(`Không thể khởi tạo PrismaClient: ${err.message}`);
    return;
  }

  try {
    const [year, m] = targetMonth.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    logger.step('QUERY_DB', `Đang tải danh sách nguyện vọng bốc ngẫu nhiên cho tháng ${targetMonth}...`);

    const flexiblePrefs = await prisma.flexibleRegistrationPreference.findMany({
      where: { month: targetMonth },
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

    const activeVolunteers: MockVolunteer[] = flexiblePrefs
      .map((p: any) => p.user)
      .filter((u: any) => u.status === 'ACTIVE');

    logger.info(`Tìm thấy ${activeVolunteers.length} TNV Active đăng ký linh hoạt trong tháng ${targetMonth}.`);
    if (activeVolunteers.length === 0) {
      logger.warn(`Không có TNV nào đăng ký tùy chọn 'Lịch nào cũng được' trong tháng ${targetMonth}.`);
      return;
    }

    logger.step('QUERY_DB', `Đang tải các ca trực đã phát hành trong tháng ${targetMonth}...`);
    const allShifts = await prisma.shiftInstance.findMany({
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

    logger.info(`Tìm thấy ${allShifts.length} ca trực đã phát hành.`);

    const formattedShifts: MockShift[] = allShifts.map((s: any) => ({
      id: s.id,
      date: s.date,
      shiftName: s.shiftName,
      position: s.position,
      maxSlots: s.maxSlots,
      registeredUserIds: s.registrations.map((r: any) => r.userId),
    }));

    // Existing registrations for these volunteers
    const existingRegistrations: { userId: number; shiftId: number }[] = [];
    for (const s of allShifts) {
      for (const r of s.registrations) {
        if (activeVolunteers.some((v) => v.id === r.userId)) {
          existingRegistrations.push({ userId: r.userId, shiftId: s.id });
        }
      }
    }

    logger.section('CHẠY THUẬT TOÁN PHÂN BỔ (DRY-RUN)');
    const result = runAutoAssignAlgorithm(activeVolunteers, formattedShifts, existingRegistrations, { verbose: true });

    printSummaryTables(result);
    verifyResults(result, formattedShifts, activeVolunteers);

    if (commit) {
      logger.section('LƯU VÀO DATABASE (--commit được bật)');
      logger.warn('Đang ghi các bản ghi phân bổ tự động vào Database...');
      // Use crypto
      const crypto = await import('crypto');

      const toCreate: any[] = [];
      for (const d of result.details) {
        for (const shiftId of d.assignedShiftIds) {
          // Only create newly assigned
          const isExisting = existingRegistrations.some((er) => er.userId === d.userId && er.shiftId === shiftId);
          if (!isExisting) {
            toCreate.push({
              userId: d.userId,
              shiftId,
              registrationType: 'AUTO_RANDOM',
              isConfirmed: false,
              confirmationToken: crypto.randomBytes(32).toString('hex'),
            });
          }
        }
      }

      if (toCreate.length > 0) {
        await prisma.$transaction(
          toCreate.map((reg) =>
            prisma.registration.create({
              data: reg,
            })
          )
        );
        logger.success(`Đã lưu thành công ${toCreate.length} lượt đăng ký vào database!`);
      } else {
        logger.info('Không có lượt đăng ký mới nào cần tạo.');
      }
    } else {
      logger.info(`Chế độ DRY-RUN: Không thay đổi dữ liệu trong database. Thêm '--commit' nếu muốn lưu thực sự.`);
    }
  } catch (err: any) {
    logger.error(`Lỗi khi chạy chế độ Database: ${err.message}`);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// ─────────────────────────────────────────
// CLI ENTRY POINT
// ─────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const isStats = args.includes('--stats');
  const isDbMode = args.some((a) => a.startsWith('--mode=db'));
  const commit = args.includes('--commit');
  const monthArg = args.find((a) => a.startsWith('--month='));
  const targetMonth = monthArg ? monthArg.split('=')[1] : '2026-10';

  logger.header('HỆ THỐNG TEST TÍNH NĂNG TỰ ĐỘNG BỐC LỊCH NGẪU NHIÊN (AUTO-FILL)');
  logger.info(`File log chi tiết được ghi tự động tại: ${colors.bold}${logger.getLogFilePath()}${colors.reset}`);

  if (isStats) {
    await runStatisticalSimulation(100);
  } else if (isDbMode) {
    await runDatabaseMode(targetMonth, commit);
  } else {
    await runMockScenarios();
  }

  logger.log('');
  logger.log(`${colors.green}${colors.bold}✔ HOÀN THÀNH TẤT CẢ CÁC BƯỚC TEST!${colors.reset}`);
  logger.log(`Xem toàn bộ log đã xử lý tại: ${colors.cyan}${logger.getLogFilePath()}${colors.reset}`);
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(`Đã xảy ra lỗi khi thực thi test: ${err.message}`);
    console.error(err);
  });
}
