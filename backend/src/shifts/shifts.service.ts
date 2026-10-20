import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftPosition, Role } from '@prisma/client';
import * as ExcelJS from 'exceljs';

interface ShiftTemplate {
  shiftName: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const SHIFT_TIMES: Record<string, ShiftTemplate> = {
  'Ca Sáng':  { shiftName: 'Ca Sáng',  startHour: 8,  startMin: 0,  endHour: 12, endMin: 0  },
  'Ca Chiều': { shiftName: 'Ca Chiều', startHour: 14, startMin: 0,  endHour: 17, endMin: 0  },
  'Ca Tối':   { shiftName: 'Ca Tối',   startHour: 19, startMin: 45, endHour: 21, endMin: 30 },
};

// DOW: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const POSITION_SCHEDULE: Record<ShiftPosition, Record<number, string[]>> = {
  [ShiftPosition.PLACE_1]: {
    2: ['Ca Tối'],              // Tuesday
    4: ['Ca Tối'],              // Thursday
    6: ['Ca Tối', 'Ca Chiều'], // Saturday
    0: ['Ca Chiều', 'Ca Sáng'], // Sunday
  },
  [ShiftPosition.PLACE_2]: {
    3: ['Ca Tối'],              // Wednesday
    5: ['Ca Tối'],              // Friday
    0: ['Ca Chiều', 'Ca Sáng'], // Sunday
  },
};

const POSITIONS = [ShiftPosition.PLACE_1, ShiftPosition.PLACE_2];

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Queries ────────────────────────────────

  async findByMonth(month: string, userId?: number) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));

    const shifts = await this.prisma.shiftInstance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          select: {
            id: true,
            userId: true,
            isConfirmed: true,
            user: {
              select: {
                ma_tnv: true,
                fullname: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { shiftName: 'asc' }, { position: 'asc' }],
    });

    return shifts.map((s) => {
      const userReg = userId ? s.registrations.find((r) => r.userId === userId) : null;
      const hasUnconfirmed = s.registrations.some((r) => !r.isConfirmed);
      return {
        ...s,
        registrationCount: s._count.registrations,
        isUserRegistered: !!userReg,
        userRegistrationId: userReg ? userReg.id : null,
        hasUnconfirmed,
        _count: undefined,
        registrations: s.registrations.map((r) => ({
          id: r.id,
          isConfirmed: r.isConfirmed,
          ma_tnv: r.user?.ma_tnv,
          fullname: r.user?.fullname,
        })),
      };
    });
  }

  async findUpcoming() {
    const now = new Date();
    const shifts = await this.prisma.shiftInstance.findMany({
      where: { date: { gte: now }, isActive: true },
      include: { _count: { select: { registrations: true } } },
      orderBy: [{ date: 'asc' }, { shiftName: 'asc' }],
      take: 100,
    });
    return shifts;
  }

  findById(id: number) {
    return this.prisma.shiftInstance.findUnique({
      where: { id },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          include: {
            user: {
              select: { id: true, ma_tnv: true, fullname: true },
            },
          },
        },
      },
    });
  }

  // ─── Admin Operations ────────────────────────

  async generateMonthlyShifts(month: string) {
    const [year, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

    const existing = await this.prisma.shiftInstance.count({
      where: {
        date: {
          gte: new Date(Date.UTC(year, m - 1, 1)),
          lte: new Date(Date.UTC(year, m, 0, 23, 59, 59)),
        },
      },
    });

    if (existing > 0) {
      throw new ConflictException(`Lịch tháng ${month} đã được khởi tạo`);
    }

    const rows: Parameters<typeof this.prisma.shiftInstance.create>[0]['data'][] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, m - 1, day));
      const dow = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      for (const position of POSITIONS) {
        const shiftNames = POSITION_SCHEDULE[position][dow] ?? [];
        for (const shiftName of shiftNames) {
          const tmpl = SHIFT_TIMES[shiftName];
          rows.push({
            date,
            shiftName: tmpl.shiftName,
            position,
            startTime: new Date(Date.UTC(1970, 0, 1, tmpl.startHour, tmpl.startMin)),
            endTime: new Date(Date.UTC(1970, 0, 1, tmpl.endHour, tmpl.endMin)),
            maxSlots: 5,
            isActive: true,
            isPublished: false,
          });
        }
      }
    }

    await this.prisma.shiftInstance.createMany({ data: rows });
    return { created: rows.length, month };
  }

  async toggleActive(id: number) {
    const shift = await this.prisma.shiftInstance.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực');
    return this.prisma.shiftInstance.update({
      where: { id },
      data: { isActive: !shift.isActive },
    });
  }

  async publishMonth(month: string) {
    const [year, m] = month.split('-').map(Number);
    const result = await this.prisma.shiftInstance.updateMany({
      where: {
        date: {
          gte: new Date(Date.UTC(year, m - 1, 1)),
          lte: new Date(Date.UTC(year, m, 0, 23, 59, 59)),
        },
        isPublished: false,
      },
      data: { isPublished: true },
    });
    return { published: result.count, month };
  }

  async exportCalendarExcel(month: string, position: ShiftPosition): Promise<Buffer> {
    const [year, m] = month.split('-').map(Number);

    const shifts = await this.prisma.shiftInstance.findMany({
      where: {
        date: { gte: new Date(Date.UTC(year, m - 1, 1)), lte: new Date(Date.UTC(year, m, 0, 23, 59, 59)) },
        position,
      },
      include: {
        registrations: {
          where: { isConfirmed: true },
          include: { user: { select: { ma_tnv: true, fullname: true, role: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { shiftName: 'asc' }],
    });

    // dateStr -> shiftName -> "Name (code)" lines
    const dataMap = new Map<string, Map<string, string[]>>();
    for (const s of shifts) {
      const key = s.date.toISOString().split('T')[0];
      if (!dataMap.has(key)) dataMap.set(key, new Map());
      dataMap.get(key)!.set(
        s.shiftName,
        s.registrations.map((r) => {
          const code = r.user.role === Role.COLLABORATOR ? 'CTV' : r.user.ma_tnv;
          return `${r.user.fullname} (${code})`;
        }),
      );
    }

    // Build weeks (Mon-Sun), entries are {day, dateStr} or null for days outside month
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const firstDow = new Date(Date.UTC(year, m - 1, 1)).getUTCDay(); // 0=Sun..6=Sat
    const offsetToMon = firstDow === 0 ? 6 : firstDow - 1; // days before first Mon

    type DayInfo = { day: number; dateStr: string } | null;
    const weeks: DayInfo[][] = [];
    for (let startDay = 1 - offsetToMon; startDay <= daysInMonth; startDay += 7) {
      const week: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
        const d = startDay + i;
        if (d < 1 || d > daysInMonth) return null;
        return { day: d, dateStr: new Date(Date.UTC(year, m - 1, d)).toISOString().split('T')[0] };
      });
      weeks.push(week);
    }

    const names = (dateStr: string | undefined, shiftName: string) =>
      dateStr ? (dataMap.get(dateStr)?.get(shiftName) ?? []).join('\n') : '';

    const dayNum = (info: DayInfo) => (info ? String(info.day) : '');

    // ─── ExcelJS setup ───────────────────────────────────────────────────────
    const isP1 = position === ShiftPosition.PLACE_1;
    const posLabel = isP1 ? '1' : '2';
    const monthLabel = `THÁNG ${String(m).padStart(2, '0')}/${year}`;
    // P1: T2 | ToiT3 | T4 | ToiT5 | T6 | [T7: date|label|names] | [CN: date|label|names]  = 11 cols
    // P2: T2 | T3 | ToiT4 | T5 | ToiT6 | T7 | [CN: date|label|names]                       = 9 cols
    const totalCols = isP1 ? 11 : 9;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`CS${posLabel} ${month}`);

    const mkFill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const mkBorder = (style: ExcelJS.BorderStyle = 'thin'): ExcelJS.Border => ({ style, color: { argb: 'FF000000' } });
    const solidBorders = { top: mkBorder(), left: mkBorder(), bottom: mkBorder(), right: mkBorder() };
    // borders for top / bottom halves of a merged pair
    const mergeTopBorder    = { top: mkBorder(), left: mkBorder(), right: mkBorder() };
    const mergeBottomBorder = { left: mkBorder(), right: mkBorder(), bottom: mkBorder() };
    const hFont = (argb = 'FFFFFFFF'): Partial<ExcelJS.Font> => ({ bold: true, color: { argb }, name: 'Arial', size: 10 });

    const DARK_BLUE = 'FF1F3864';
    const YELLOW    = 'FFFFD966';
    const ROW_ODD   = 'FFFFFFFF';
    const ROW_EVEN  = 'FFFFF2CC';
    const RED       = 'FFC00000';

    if (isP1) {
      ws.columns = [
        { width: 8 }, { width: 24 }, { width: 8 }, { width: 24 }, { width: 8 },
        { width: 6 }, { width: 9 }, { width: 22 },
        { width: 6 }, { width: 9 }, { width: 22 },
      ];
    } else {
      ws.columns = [
        { width: 8 }, { width: 8 }, { width: 24 }, { width: 8 }, { width: 24 }, { width: 8 },
        { width: 6 }, { width: 9 }, { width: 22 },
      ];
    }

    // ─── Row 1: Title ────────────────────────────────────────────────────────
    const r1 = ws.addRow(Array(totalCols).fill(''));
    r1.height = 28;
    ws.mergeCells(1, 1, 1, totalCols);
    Object.assign(ws.getCell(1, 1), {
      value: `LỊCH TRỰC THƯ VIỆN ${monthLabel} CƠ SỞ ${posLabel}`,
      fill: mkFill(DARK_BLUE),
      font: { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 13 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: solidBorders,
    });

    // ─── Row 2: Headers ──────────────────────────────────────────────────────
    const r2 = ws.addRow(Array(totalCols).fill(''));
    r2.height = 24;
    const applyHeader = (col: number, text: string, isShift = false) => {
      const cell = r2.getCell(col);
      cell.value = text;
      cell.fill = mkFill(isShift ? YELLOW : DARK_BLUE);
      cell.font = hFont(isShift ? 'FF000000' : 'FFFFFFFF');
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = solidBorders;
    };
    const styleHeaderRange = (fromCol: number, toCol: number) => {
      for (let c = fromCol; c <= toCol; c++) {
        r2.getCell(c).fill = mkFill(DARK_BLUE);
        r2.getCell(c).font = hFont();
        r2.getCell(c).border = solidBorders;
        r2.getCell(c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    };

    // Each "simple" column carries a day-number (sub-row 1) and optional volunteer names (sub-row 2)
    type SingleCol = {
      idx: number;
      getDayNum: (week: DayInfo[]) => string;
      getNames:  (week: DayInfo[]) => string;
    };
    type ShiftDef = { name: string; label: string };
    type GroupConfig = {
      weekDayIndex: number; // 5=Saturday, 6=Sunday
      dateCol: number;
      labelCol: number;
      namesCol: number;
      shift1: ShiftDef;
      shift2: ShiftDef;
    };

    let singleCols: SingleCol[];
    let groupConfigs: GroupConfig[];

    if (isP1) {
      applyHeader(1, 'Thứ 2');
      applyHeader(2, 'Tối thứ 3', true);
      applyHeader(3, 'Thứ 4');
      applyHeader(4, 'Tối thứ 5', true);
      applyHeader(5, 'Thứ 6');
      styleHeaderRange(6, 8);
      ws.mergeCells(2, 6, 2, 8);
      r2.getCell(6).value = 'Thứ 7';
      styleHeaderRange(9, 11);
      ws.mergeCells(2, 9, 2, 11);
      r2.getCell(9).value = 'Chủ nhật';

      singleCols = [
        { idx: 1, getDayNum: (w) => dayNum(w[0]), getNames: (_w) => '' },                            // T2 (no shift)
        { idx: 2, getDayNum: (w) => dayNum(w[1]), getNames: (w) => names(w[1]?.dateStr, 'Ca Tối') }, // Tối T3
        { idx: 3, getDayNum: (w) => dayNum(w[2]), getNames: (_w) => '' },                            // T4 (no shift)
        { idx: 4, getDayNum: (w) => dayNum(w[3]), getNames: (w) => names(w[3]?.dateStr, 'Ca Tối') }, // Tối T5
        { idx: 5, getDayNum: (w) => dayNum(w[4]), getNames: (_w) => '' },                            // T6 (no shift)
      ];
      groupConfigs = [
        {
          weekDayIndex: 5, dateCol: 6, labelCol: 7, namesCol: 8,
          shift1: { name: 'Ca Chiều', label: 'Chiều' },
          shift2: { name: 'Ca Tối',   label: 'Tối'   },
        }, // Thứ 7
        {
          weekDayIndex: 6, dateCol: 9, labelCol: 10, namesCol: 11,
          shift1: { name: 'Ca Sáng',  label: 'Sáng'  },
          shift2: { name: 'Ca Chiều', label: 'Chiều' },
        }, // Chủ nhật
      ];
    } else {
      applyHeader(1, 'Thứ 2');
      applyHeader(2, 'Thứ 3');
      applyHeader(3, 'Tối thứ 4', true);
      applyHeader(4, 'Thứ 5');
      applyHeader(5, 'Tối thứ 6', true);
      applyHeader(6, 'Thứ 7');
      styleHeaderRange(7, 9);
      ws.mergeCells(2, 7, 2, 9);
      r2.getCell(7).value = 'Chủ nhật';

      singleCols = [
        { idx: 1, getDayNum: (w) => dayNum(w[0]), getNames: (_w) => '' },                            // T2 (no shift)
        { idx: 2, getDayNum: (w) => dayNum(w[1]), getNames: (_w) => '' },                            // T3 (no shift)
        { idx: 3, getDayNum: (w) => dayNum(w[2]), getNames: (w) => names(w[2]?.dateStr, 'Ca Tối') }, // Tối T4
        { idx: 4, getDayNum: (w) => dayNum(w[3]), getNames: (_w) => '' },                            // T5 (no shift)
        { idx: 5, getDayNum: (w) => dayNum(w[4]), getNames: (w) => names(w[4]?.dateStr, 'Ca Tối') }, // Tối T6
        { idx: 6, getDayNum: (w) => dayNum(w[5]), getNames: (_w) => '' },                            // T7 (no shift)
      ];
      groupConfigs = [
        {
          weekDayIndex: 6, dateCol: 7, labelCol: 8, namesCol: 9,
          shift1: { name: 'Ca Sáng',  label: 'Sáng'  },
          shift2: { name: 'Ca Chiều', label: 'Chiều' },
        }, // Chủ nhật
      ];
    }

    // ─── Data rows: always 2 physical sub-rows per calendar week ─────────────
    //   Sub-row 1 (top)    → day numbers only (bold, centered)
    //   Sub-row 2 (bottom) → volunteer names (wrapping text)
    weeks.forEach((week, idx) => {
      const rowStart = ws.rowCount + 1;
      ws.addRow(Array(totalCols).fill(''));
      ws.addRow(Array(totalCols).fill(''));

      const bg = mkFill(idx % 2 === 0 ? ROW_EVEN : ROW_ODD);

      // ── Simple columns ────────────────────────────────────────────────────
      singleCols.forEach((sc) => {
        // Sub-row 1: day number
        const dayCell = ws.getCell(rowStart, sc.idx);
        dayCell.value = sc.getDayNum(week);
        dayCell.fill = bg;
        dayCell.font = { bold: true, name: 'Arial', size: 10 };
        dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
        dayCell.border = mergeTopBorder;

        // Sub-row 2: volunteer names
        const namesCell = ws.getCell(rowStart + 1, sc.idx);
        namesCell.value = sc.getNames(week);
        namesCell.fill = bg;
        namesCell.font = { name: 'Arial', size: 10 };
        namesCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
        namesCell.border = mergeBottomBorder;
      });

      // ── 2-shift groups (Thứ 7 / Chủ nhật) ───────────────────────────────
      groupConfigs.forEach((cfg) => {
        const dayInfo = week[cfg.weekDayIndex];

        // Date cell: merged across both sub-rows
        const dateCellTop = ws.getCell(rowStart, cfg.dateCol);
        dateCellTop.value = dayNum(dayInfo);
        dateCellTop.fill = bg;
        dateCellTop.font = { bold: true, name: 'Arial', size: 10 };
        dateCellTop.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.mergeCells(rowStart, cfg.dateCol, rowStart + 1, cfg.dateCol);
        dateCellTop.border = mergeTopBorder;
        const dateCellBottom = ws.getCell(rowStart + 1, cfg.dateCol);
        dateCellBottom.fill = bg;
        dateCellBottom.border = mergeBottomBorder;

        // Shift 1 → sub-row 1, Shift 2 → sub-row 2
        [cfg.shift1, cfg.shift2].forEach((shift, si) => {
          const r = rowStart + si;
          const border = si === 0 ? mergeTopBorder : mergeBottomBorder;

          const labelCell = ws.getCell(r, cfg.labelCol);
          labelCell.value = dayInfo ? shift.label : '';
          labelCell.font = { bold: true, color: { argb: RED }, name: 'Arial', size: 10 };
          labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
          labelCell.fill = bg;
          labelCell.border = border;

          const namesCell = ws.getCell(r, cfg.namesCol);
          namesCell.value = dayInfo ? names(dayInfo.dateStr, shift.name) : '';
          namesCell.font = { name: 'Arial', size: 10 };
          namesCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
          namesCell.fill = bg;
          namesCell.border = border;
        });
      });

      // ── Row heights ───────────────────────────────────────────────────────
      // Sub-row 1 (day numbers): fixed compact height
      ws.getRow(rowStart).height = 18;
      // Sub-row 2 (names): expand to fit content
      let maxLines = 1;
      ws.getRow(rowStart + 1).eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === 'string') {
          const lines = (cell.value.match(/\n/g) || []).length + 1;
          if (lines > maxLines) maxLines = lines;
        }
      });
      ws.getRow(rowStart + 1).height = Math.max(22, maxLines * 16);
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
