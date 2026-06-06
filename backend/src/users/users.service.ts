import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByMaTnv(ma_tnv: string) {
    return this.prisma.user.findUnique({ where: { ma_tnv } });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  getProfile(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        ma_tnv: true,
        fullname: true,
        email: true,
        date_of_birth: true,
        role: true,
        status: true,
        avatar: true,
        min_shifts_per_month: true,
      },
    });
  }

  findAll(filters?: { status?: UserStatus; role?: Role; search?: string }) {
    return this.prisma.user.findMany({
      where: {
        role: filters?.role ?? Role.VOLUNTEER,
        status: filters?.status,
        ...(filters?.search && {
          OR: [
            { fullname: { contains: filters.search } },
            { ma_tnv: { contains: filters.search } },
          ],
        }),
      },
      orderBy: { fullname: 'asc' },
      select: {
        id: true,
        ma_tnv: true,
        fullname: true,
        email: true,
        role: true,
        status: true,
        min_shifts_per_month: true,
        createdAt: true,
      },
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.ensureExists(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        ma_tnv: true,
        fullname: true,
        email: true,
        role: true,
        status: true,
        min_shifts_per_month: true,
      },
    });
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async updateAvatar(userId: number, file: { buffer: Buffer; originalname: string }) {
    const ext = extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowed.includes(ext)) {
      throw new BadRequestException('Chỉ hỗ trợ định dạng: jpg, jpeg, png, gif, webp');
    }

    const filename = `${randomBytes(16).toString('hex')}${ext}`;
    const uploadDir = join(process.cwd(), 'uploads', 'avatars');

    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    writeFileSync(join(uploadDir, filename), file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });
  }

  async createUser(dto: { fullname: string; ma_tnv: string; date_of_birth: string; email: string }) {
    const existing = await this.prisma.user.findUnique({ where: { ma_tnv: dto.ma_tnv } });
    if (existing) throw new ConflictException(`Mã TNV "${dto.ma_tnv}" đã tồn tại`);

    if (!dto.email?.trim()) throw new BadRequestException('Email là bắt buộc');

    const rawPassword = this.generatePassword(dto.ma_tnv, dto.date_of_birth);
    const password = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        fullname: dto.fullname.trim(),
        ma_tnv: dto.ma_tnv.trim(),
        date_of_birth: dto.date_of_birth,
        email: dto.email.trim(),
        password,
      },
      select: { id: true, ma_tnv: true, fullname: true, email: true, status: true, date_of_birth: true },
    });

    return { ...user, generatedPassword: rawPassword };
  }

  async bulkCreateFromCsv(csvText: string) {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('File CSV phải có ít nhất 1 dòng dữ liệu');

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('fullname');
    const idIdx = headers.indexOf('ma_tnv');
    const dobIdx = headers.indexOf('date_of_birth');
    const emailIdx = headers.indexOf('email');

    if (nameIdx === -1 || idIdx === -1 || dobIdx === -1) {
      throw new BadRequestException('CSV phải có các cột: fullname, ma_tnv, date_of_birth, email');
    }
    if (emailIdx === -1) {
      throw new BadRequestException('CSV phải có cột email');
    }

    const results: { ma_tnv: string; fullname: string; status: 'created' | 'error'; generatedPassword?: string; reason?: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const fullname = cols[nameIdx];
      const ma_tnv = cols[idIdx];
      const rawDob = cols[dobIdx];
      const email = emailIdx !== -1 ? cols[emailIdx] : '';

      if (!fullname || !ma_tnv || !rawDob) {
        results.push({ ma_tnv: ma_tnv || `dòng ${i + 1}`, fullname: fullname || '', status: 'error', reason: 'Thiếu dữ liệu' });
        continue;
      }

      if (!email) {
        results.push({ ma_tnv, fullname, status: 'error', reason: 'Email là bắt buộc' });
        continue;
      }

      const date_of_birth = this.normalizeDob(rawDob);
      if (!date_of_birth) {
        results.push({ ma_tnv, fullname, status: 'error', reason: 'Ngày sinh không hợp lệ (dùng YYYY-MM-DD hoặc DD/MM/YYYY)' });
        continue;
      }

      try {
        const result = await this.createUser({ fullname, ma_tnv, date_of_birth, email });
        results.push({ ma_tnv, fullname, status: 'created', generatedPassword: result.generatedPassword });
      } catch (err) {
        results.push({ ma_tnv, fullname, status: 'error', reason: err.message });
      }
    }

    return {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  /** ma_tnv + DDMMYYYY */
  generatePassword(ma_tnv: string, date_of_birth: string): string {
    const [year, month, day] = date_of_birth.split('-');
    return `${ma_tnv}${day}${month}${year}`;
  }

  /** Accept YYYY-MM-DD or DD/MM/YYYY, return YYYY-MM-DD or null */
  private normalizeDob(raw: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('/');
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  async deleteAllVolunteers() {
    const result = await this.prisma.user.deleteMany({ where: { role: Role.VOLUNTEER } });
    return { deleted: result.count };
  }

  private async ensureExists(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy tình nguyện viên');
    return user;
  }
}
