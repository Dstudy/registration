import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestType, RequestStatus, RegistrationType } from '@prisma/client';
import { CreateRequestDto } from './dto/create-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createRequest(senderId: number, dto: CreateRequestDto) {
    // Resolve receiverCode → receiverId
    let resolvedReceiverId = dto.receiverId ?? null;
    if (dto.receiverCode && !resolvedReceiverId) {
      const receiver = await this.prisma.user.findUnique({ where: { ma_tnv: dto.receiverCode.toUpperCase() } });
      if (!receiver) throw new BadRequestException(`Không tìm thấy mã TNV: ${dto.receiverCode}`);
      resolvedReceiverId = receiver.id;
    }

    // Verify sender owns shiftIdFrom
    const senderReg = await this.prisma.registration.findUnique({
      where: { userId_shiftId: { userId: senderId, shiftId: dto.shiftIdFrom } },
    });
    if (!senderReg) {
      throw new BadRequestException('Bạn không có đăng ký ca trực này');
    }

    // Prevent duplicate active requests for the same shift
    const existingRequest = await this.prisma.shiftRequest.findFirst({
      where: {
        senderId,
        shiftIdFrom: dto.shiftIdFrom,
        type: dto.type,
        status: { in: [RequestStatus.PENDING, RequestStatus.ACCEPTED_BY_RECEIVER] },
      },
    });
    if (existingRequest) {
      throw new ConflictException('Bạn đã có yêu cầu đang xử lý cho ca trực này');
    }

    if (dto.type === RequestType.SWAP) {
      if (!dto.shiftIdTo) {
        throw new BadRequestException('Đổi ca cần có shiftIdTo');
      }
      // Auto-resolve receiver from whoever registered for shiftIdTo
      if (!resolvedReceiverId) {
        const receiverReg = await this.prisma.registration.findFirst({
          where: { shiftId: dto.shiftIdTo },
          select: { userId: true },
        });
        if (!receiverReg) {
          throw new BadRequestException('Không tìm thấy người đăng ký ca trực này để đổi');
        }
        resolvedReceiverId = receiverReg.userId;
      } else {
        // If receiver was explicitly provided, still verify they own shiftIdTo
        const receiverReg = await this.prisma.registration.findUnique({
          where: { userId_shiftId: { userId: resolvedReceiverId, shiftId: dto.shiftIdTo } },
        });
        if (!receiverReg) {
          throw new BadRequestException('Người nhận không có ca trực này để đổi');
        }
      }
    }

    const request = await this.prisma.shiftRequest.create({
      data: {
        senderId,
        receiverId: resolvedReceiverId,
        shiftIdFrom: dto.shiftIdFrom,
        shiftIdTo: dto.shiftIdTo ?? null,
        type: dto.type,
        status: RequestStatus.PENDING,
        note: dto.note ?? null,
      },
      include: {
        sender: { select: { fullname: true } },
      },
    });

    // Notify receiver (or broadcast to all if public)
    if (resolvedReceiverId) {
      const typeLabel = dto.type === RequestType.SWAP ? 'đổi ca' : 'trông hộ';
      await this.notifications.create(
        resolvedReceiverId,
        `Yêu cầu ${typeLabel} từ ${request.sender.fullname}`,
        `${request.sender.fullname} muốn ${typeLabel} với bạn. Vào mục Yêu cầu để phản hồi.`,
        NotificationType.REQUEST,
      );
    }

    return request;
  }

  async acceptRequest(receiverId: number, requestId: number) {
    const request = await this.getRequestOrThrow(requestId);

    if (request.receiverId !== receiverId) {
      throw new ForbiddenException('Bạn không phải người nhận yêu cầu này');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không ở trạng thái chờ');
    }

    // Check receiver won't have a same-shift conflict after accepting
    const shiftFrom = await this.prisma.shiftInstance.findUnique({
      where: { id: request.shiftIdFrom },
      select: { date: true, shiftName: true },
    });
    if (shiftFrom) {
      // Receiver gains shiftIdFrom; exclude shiftIdTo (they're giving it away in a SWAP)
      const excludeIds = request.shiftIdTo ? [request.shiftIdTo] : [];
      await this.checkSameShiftConflict(receiverId, request.shiftIdFrom, shiftFrom.date, shiftFrom.shiftName, excludeIds);
    }

    const updated = await this.prisma.shiftRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.ACCEPTED_BY_RECEIVER },
      include: { receiver: { select: { fullname: true } } },
    });

    // Notify admin
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.notifications.create(
        admin.id,
        'Yêu cầu đổi/trông hộ cần duyệt',
        `${updated.receiver?.fullname} đã đồng ý. Vào Dashboard để phê duyệt.`,
        NotificationType.WARNING,
      );
    }

    return updated;
  }

  async rejectRequest(userId: number, requestId: number) {
    const request = await this.getRequestOrThrow(requestId);

    if (request.receiverId !== userId && request.senderId !== userId) {
      throw new ForbiddenException('Không có quyền từ chối yêu cầu này');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không ở trạng thái chờ');
    }

    return this.prisma.shiftRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.REJECTED },
    });
  }

  async cancelRequest(senderId: number, requestId: number) {
    const request = await this.getRequestOrThrow(requestId);

    if (request.senderId !== senderId) {
      throw new ForbiddenException('Chỉ người gửi mới có thể hủy yêu cầu');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ');
    }

    return this.prisma.shiftRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.CANCELED },
    });
  }

  async adminApprove(adminId: number, requestId: number) {
    const request = await this.getRequestOrThrow(requestId);

    if (request.status !== RequestStatus.ACCEPTED_BY_RECEIVER) {
      throw new BadRequestException('Yêu cầu chưa được người nhận đồng ý');
    }

    // Final same-shift conflict check before committing the swap/substitute
    const shiftFrom = await this.prisma.shiftInstance.findUnique({
      where: { id: request.shiftIdFrom },
      select: { date: true, shiftName: true },
    });
    if (request.type === RequestType.SWAP && request.shiftIdTo && request.receiverId && shiftFrom) {
      const shiftTo = await this.prisma.shiftInstance.findUnique({
        where: { id: request.shiftIdTo },
        select: { date: true, shiftName: true },
      });
      if (shiftTo) {
        // Sender gives away shiftIdFrom, gains shiftIdTo
        await this.checkSameShiftConflict(
          request.senderId, request.shiftIdTo, shiftTo.date, shiftTo.shiftName, [request.shiftIdFrom],
        );
        // Receiver gives away shiftIdTo, gains shiftIdFrom
        await this.checkSameShiftConflict(
          request.receiverId, request.shiftIdFrom, shiftFrom.date, shiftFrom.shiftName, [request.shiftIdTo],
        );
      }
    } else if (request.type === RequestType.SUBSTITUTE && request.receiverId && shiftFrom) {
      // Receiver gains shiftIdFrom
      await this.checkSameShiftConflict(
        request.receiverId, request.shiftIdFrom, shiftFrom.date, shiftFrom.shiftName,
      );
    }

    // Pre-approval KPI warnings
    const warnings = await this.computeKpiWarnings(request);

    await this.prisma.$transaction(async (tx) => {
      if (request.type === RequestType.SWAP) {
        if (!request.shiftIdTo || !request.receiverId) {
          throw new BadRequestException('Thiếu thông tin để đổi ca');
        }
        // Swap: exchange userId between registrations
        const senderReg = await tx.registration.findUnique({
          where: { userId_shiftId: { userId: request.senderId, shiftId: request.shiftIdFrom } },
        });
        const receiverReg = await tx.registration.findUnique({
          where: { userId_shiftId: { userId: request.receiverId, shiftId: request.shiftIdTo } },
        });
        if (!senderReg || !receiverReg) throw new BadRequestException('Không tìm thấy đăng ký');

        // Delete both, re-create swapped
        await tx.registration.delete({ where: { id: senderReg.id } });
        await tx.registration.delete({ where: { id: receiverReg.id } });

        await tx.registration.create({
          data: {
            userId: request.senderId,
            shiftId: request.shiftIdTo,
            registrationType: RegistrationType.SUBSTITUTE,
            isConfirmed: true,
          },
        });
        await tx.registration.create({
          data: {
            userId: request.receiverId,
            shiftId: request.shiftIdFrom,
            registrationType: RegistrationType.SUBSTITUTE,
            isConfirmed: true,
          },
        });
      } else {
        // SUBSTITUTE: sender loses the shift, receiver gains it
        if (!request.receiverId) throw new BadRequestException('Thiếu thông tin người nhận');
        await tx.registration.deleteMany({
          where: { userId: request.senderId, shiftId: request.shiftIdFrom },
        });
        await tx.registration.upsert({
          where: { userId_shiftId: { userId: request.receiverId, shiftId: request.shiftIdFrom } },
          update: { registrationType: RegistrationType.SUBSTITUTE },
          create: {
            userId: request.receiverId,
            shiftId: request.shiftIdFrom,
            registrationType: RegistrationType.SUBSTITUTE,
            isConfirmed: true,
          },
        });
      }

      await tx.shiftRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.APPROVED_BY_BNS },
      });
    });

    // Notify both parties
    const notifyUserIds = [request.senderId];
    if (request.receiverId) notifyUserIds.push(request.receiverId);

    for (const uid of notifyUserIds) {
      await this.notifications.create(
        uid,
        'Yêu cầu đã được BNS phê duyệt',
        'Lịch trực của bạn đã được cập nhật. Vui lòng kiểm tra lịch.',
        NotificationType.INFO,
      );
    }

    return { approved: true, warnings };
  }

  // ─── Queries ────────────────────────────────

  findForUser(userId: number) {
    return this.prisma.shiftRequest.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, ma_tnv: true, fullname: true } },
        receiver: { select: { id: true, ma_tnv: true, fullname: true } },
        shiftFrom: { select: { id: true, date: true, shiftName: true, position: true } },
        shiftTo: { select: { id: true, date: true, shiftName: true, position: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPublicRequests(userId: number) {
    return this.prisma.shiftRequest.findMany({
      where: {
        receiverId: null,
        status: RequestStatus.PENDING,
        senderId: { not: userId },
      },
      include: {
        sender: { select: { id: true, ma_tnv: true, fullname: true } },
        shiftFrom: { select: { id: true, date: true, shiftName: true, position: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingForAdmin() {
    return this.prisma.shiftRequest.findMany({
      where: { status: RequestStatus.ACCEPTED_BY_RECEIVER },
      include: {
        sender: { select: { id: true, ma_tnv: true, fullname: true, min_shifts_per_month: true } },
        receiver: { select: { id: true, ma_tnv: true, fullname: true, min_shifts_per_month: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  findAllForAdmin() {
    return this.prisma.shiftRequest.findMany({
      include: {
        sender: { select: { id: true, ma_tnv: true, fullname: true } },
        receiver: { select: { id: true, ma_tnv: true, fullname: true } },
        shiftFrom: { select: { id: true, date: true, shiftName: true, position: true } },
        shiftTo: { select: { id: true, date: true, shiftName: true, position: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async takePublicRequest(takerId: number, requestId: number) {
    const request = await this.getRequestOrThrow(requestId);

    if (request.receiverId !== null) {
      throw new BadRequestException('Yêu cầu này đã có người nhận');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không còn khả dụng');
    }
    if (request.senderId === takerId) {
      throw new BadRequestException('Bạn không thể nhận yêu cầu của chính mình');
    }

    // Taker will gain shiftIdFrom — check for same-shift conflict
    const shiftFrom = await this.prisma.shiftInstance.findUnique({
      where: { id: request.shiftIdFrom },
      select: { date: true, shiftName: true },
    });
    if (shiftFrom) {
      await this.checkSameShiftConflict(takerId, request.shiftIdFrom, shiftFrom.date, shiftFrom.shiftName);
    }

    return this.prisma.shiftRequest.update({
      where: { id: requestId },
      data: { receiverId: takerId, status: RequestStatus.ACCEPTED_BY_RECEIVER },
    });
  }

  async adminReject(requestId: number) {
    const request = await this.getRequestOrThrow(requestId);

    const updated = await this.prisma.shiftRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.REJECTED },
    });

    const notifyUserIds = [request.senderId];
    if (request.receiverId) notifyUserIds.push(request.receiverId);
    for (const uid of notifyUserIds) {
      await this.notifications.create(
        uid,
        'Yêu cầu bị BNS từ chối',
        'Yêu cầu đổi/thay ca của bạn không được phê duyệt.',
        NotificationType.WARNING,
      );
    }

    return updated;
  }

  // ─── Helpers ─────────────────────────────────

  private async checkSameShiftConflict(
    userId: number,
    targetShiftId: number,
    targetDate: Date,
    targetShiftName: string,
    excludeShiftIds: number[] = [],
  ): Promise<void> {
    const conflict = await this.prisma.registration.findFirst({
      where: {
        userId,
        shiftId: { notIn: [targetShiftId, ...excludeShiftIds] },
        shift: { date: targetDate, shiftName: targetShiftName },
      },
    });
    if (conflict) {
      throw new ConflictException('Ca trực bị trùng thời gian với ca trực tại địa điểm khác');
    }
  }

  private getRequestOrThrow(id: number) {
    return this.prisma.shiftRequest
      .findUnique({ where: { id } })
      .then((r) => {
        if (!r) throw new NotFoundException('Không tìm thấy yêu cầu');
        return r;
      });
  }

  private async computeKpiWarnings(request: { senderId: number; receiverId: number | null; type: RequestType }) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const countShifts = async (userId: number) => {
      return this.prisma.registration.count({
        where: {
          userId,
          shift: {
            date: {
              gte: new Date(Date.UTC(year, month - 1, 1)),
              lte: new Date(Date.UTC(year, month, 0, 23, 59, 59)),
            },
          },
        },
      });
    };

    const sender = await this.prisma.user.findUnique({ where: { id: request.senderId } });
    const senderCount = await countShifts(request.senderId);
    const warnings: string[] = [];

    if (sender && senderCount - 1 < sender.min_shifts_per_month) {
      warnings.push(`${sender.fullname} sẽ chỉ còn ${senderCount - 1}/${sender.min_shifts_per_month} buổi (dưới KPI)`);
    }

    if (request.receiverId) {
      const receiver = await this.prisma.user.findUnique({ where: { id: request.receiverId } });
      if (receiver) {
        const receiverCount = await countShifts(request.receiverId);
        if (receiverCount + 1 > receiver.min_shifts_per_month * 2) {
          warnings.push(`${receiver.fullname} sẽ có ${receiverCount + 1} buổi (nhiều hơn bình thường)`);
        }
      }
    }

    return warnings;
  }
}
