import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi máy chủ nội bộ';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Prisma error ${exception.code}: ${exception.message}`, exception.stack);
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Dữ liệu đã tồn tại';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Không tìm thấy dữ liệu';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Dữ liệu liên kết không hợp lệ';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Lỗi cơ sở dữ liệu';
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.error(`Prisma init error: ${exception.message}`, exception.stack);
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Không thể kết nối cơ sở dữ liệu';
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
