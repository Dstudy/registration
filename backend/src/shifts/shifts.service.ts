import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftPosition } from '@prisma/client';
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
        registrations: userId
          ? { where: { userId }, select: { id: true } }
          : false,
      },
      orderBy: [{ date: 'asc' }, { shiftName: 'asc' }, { position: 'asc' }],
    });

    return shifts.map((s) => ({
      ...s,
      registrationCount: s._count.registrations,
      isUserRegistered: userId ? s.registrations.length > 0 : undefined,
      userRegistrationId: userId ? (s.registrations[0]?.id ?? null) : undefined,
      _count: undefined,
      registrations: undefined,
    }));
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
          include: { user: { select: { ma_tnv: true, fullname: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { shiftName: 'asc' }],
    });

    // dateStr -> shiftName -> "Name (code)" lines
    const dataMap = new Map<string, Map<string, string[]>>();
    for (const s of shifts) {
      const key = s.date.toISOString().split('T')[0];
      if (!dataMap.has(key)) dataMap.set(key, new Map());
      dataMap.get(key)!.set(s.shiftName, s.registrations.map((r) => `${r.user.fullname} (${r.user.ma_tnv})`));
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

    // cell with date + names for a shift day
    const shiftCell = (info: DayInfo, shiftName: string) => {
      const d = dayNum(info);
      const n = names(info?.dateStr, shiftName);
      return d ? (n ? `${d}\n${n}` : d) : n;
    };

    // ─── ExcelJS setup ──────────────────────────────────────────────────────────
    const isP1 = position === ShiftPosition.PLACE_1;
    const posLabel = isP1 ? '1' : '2';
    const monthLabel = `THÁNG ${String(m).padStart(2, '0')}/${year}`;
    const totalCols = isP1 ? 9 : 8;
    const lastColLetter = isP1 ? 'I' : 'H';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`CS${posLabel} ${month}`);

    const mkFill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const mkBorder = (style: ExcelJS.BorderStyle = 'thin'): ExcelJS.Border => ({ style, color: { argb: 'FF000000' } });
    const solidBorders = { top: mkBorder(), left: mkBorder(), bottom: mkBorder(), right: mkBorder() };
    const dataBorders = { top: mkBorder(), left: mkBorder(), bottom: mkBorder('dotted'), right: mkBorder() };
    const hFont = (argb = 'FFFFFFFF'): Partial<ExcelJS.Font> => ({ bold: true, color: { argb }, name: 'Arial', size: 10 });

    const DARK_BLUE = 'FF1F3864';
    const YELLOW = 'FFFFD966';
    const ROW_ODD = 'FFFFFFFF';
    const ROW_EVEN = 'FFFFF2CC';

    if (isP1) {
      // T2 | TốiT3 | T4 | TốiT5 | T6 | T7-Chiều | T7-Tối | CN-Sáng | CN-Chiều
      ws.columns = [
        { width: 8 }, { width: 24 }, { width: 8 }, { width: 24 },
        { width: 8 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 },
      ];
    } else {
      // T2 | T3 | TốiT4 | T5 | TốiT6 | T7 | CN-Sáng | CN-Chiều
      ws.columns = [
        { width: 8 }, { width: 8 }, { width: 22 }, { width: 8 },
        { width: 22 }, { width: 8 }, { width: 22 }, { width: 22 },
      ];
    }

    // ─── Row 1: Title ────────────────────────────────────────────────────────
    const r1 = ws.addRow(Array(totalCols).fill(''));
    r1.height = 28;
    ws.mergeCells(`A1:${lastColLetter}1`);
    Object.assign(ws.getCell('A1'), {
      value: `LỊCH TRÔNG THƯ VIỆN ${monthLabel} CƠ SỞ ${posLabel}`,
      fill: mkFill(DARK_BLUE),
      font: { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 13 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: solidBorders,
    });

    // ─── Row 2: Main headers ─────────────────────────────────────────────────
    const r2 = ws.addRow(Array(totalCols).fill(''));
    r2.height = 22;
    const applyHeader = (col: number, text: string, isShift = false) => {
      const cell = r2.getCell(col);
      cell.value = text;
      cell.fill = mkFill(isShift ? YELLOW : DARK_BLUE);
      cell.font = hFont(isShift ? 'FF000000' : 'FFFFFFFF');
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = solidBorders;
    };
    if (isP1) {
      applyHeader(1, 'Thứ 2'); applyHeader(2, 'Tối thứ 3', true); applyHeader(3, 'Thứ 4');
      applyHeader(4, 'Tối thứ 5', true); applyHeader(5, 'Thứ 6');
      ws.mergeCells('F2:G2'); applyHeader(6, 'Thứ 7');
      ws.mergeCells('H2:I2'); applyHeader(8, 'Chủ nhật');
      r2.getCell(7).fill = mkFill(DARK_BLUE); r2.getCell(7).border = solidBorders;
      r2.getCell(9).fill = mkFill(DARK_BLUE); r2.getCell(9).border = solidBorders;
    } else {
      applyHeader(1, 'Thứ 2'); applyHeader(2, 'Thứ 3'); applyHeader(3, 'Tối thứ 4', true);
      applyHeader(4, 'Thứ 5'); applyHeader(5, 'Tối thứ 6', true); applyHeader(6, 'Thứ 7');
      ws.mergeCells('G2:H2'); applyHeader(7, 'Chủ nhật');
      r2.getCell(8).fill = mkFill(DARK_BLUE); r2.getCell(8).border = solidBorders;
    }

    // ─── Row 3: Sub-headers ──────────────────────────────────────────────────
    const r3 = ws.addRow(Array(totalCols).fill(''));
    r3.height = 16;
    for (let c = 1; c <= totalCols; c++) {
      r3.getCell(c).fill = mkFill(DARK_BLUE);
      r3.getCell(c).font = hFont();
      r3.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      r3.getCell(c).border = solidBorders;
    }
    const applySubHeader = (col: number, text: string) => {
      r3.getCell(col).value = text;
      r3.getCell(col).fill = mkFill(YELLOW);
      r3.getCell(col).font = hFont('FF000000');
    };
    if (isP1) {
      applySubHeader(2, ''); applySubHeader(4, ''); // shift cols keep yellow bg
      r3.getCell(2).fill = mkFill(YELLOW); r3.getCell(2).font = hFont('FF000000');
      r3.getCell(4).fill = mkFill(YELLOW); r3.getCell(4).font = hFont('FF000000');
      applySubHeader(6, 'Chiều'); applySubHeader(7, 'Tối');
      applySubHeader(8, 'Sáng'); applySubHeader(9, 'Chiều');
    } else {
      r3.getCell(3).fill = mkFill(YELLOW); r3.getCell(3).font = hFont('FF000000');
      r3.getCell(5).fill = mkFill(YELLOW); r3.getCell(5).font = hFont('FF000000');
      applySubHeader(7, 'Sáng'); applySubHeader(8, 'Chiều');
    }

    // ─── Data rows (one per week) ────────────────────────────────────────────
    weeks.forEach((week, idx) => {
      // week[0]=Mon, [1]=Tue, [2]=Wed, [3]=Thu, [4]=Fri, [5]=Sat, [6]=Sun
      let values: string[];
      if (isP1) {
        values = [
          dayNum(week[0]),                          // T2
          shiftCell(week[1], 'Ca Tối'),              // Tối T3
          dayNum(week[2]),                          // T4
          shiftCell(week[3], 'Ca Tối'),              // Tối T5
          dayNum(week[4]),                          // T6
          shiftCell(week[5], 'Ca Chiều'),            // T7-Chiều (date shown here)
          names(week[5]?.dateStr, 'Ca Tối'),         // T7-Tối   (no date)
          shiftCell(week[6], 'Ca Sáng'),             // CN-Sáng  (date shown here)
          names(week[6]?.dateStr, 'Ca Chiều'),       // CN-Chiều (no date)
        ];
      } else {
        values = [
          dayNum(week[0]),                          // T2
          dayNum(week[1]),                          // T3
          shiftCell(week[2], 'Ca Tối'),              // Tối T4
          dayNum(week[3]),                          // T5
          shiftCell(week[4], 'Ca Tối'),              // Tối T6
          dayNum(week[5]),                          // T7
          shiftCell(week[6], 'Ca Sáng'),             // CN-Sáng (date shown here)
          names(week[6]?.dateStr, 'Ca Chiều'),       // CN-Chiều (no date)
        ];
      }

      const dataRow = ws.addRow(values);
      const rowNum = dataRow.number;
      const bg = mkFill(idx % 2 === 0 ? ROW_ODD : ROW_EVEN);
      const maxLines = Math.max(...values.map((v) => (v ? (v.match(/\n/g) || []).length + 1 : 1)));
      dataRow.height = Math.max(42, maxLines * 18);

      for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(rowNum, c);
        cell.fill = bg;
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
        cell.border = dataBorders;
        cell.font = { name: 'Arial', size: 10 };
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
