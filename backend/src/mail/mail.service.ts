import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: configService.get<string>('GMAIL_USER'),
        pass: configService.get<string>('GMAIL_APP_PASSWORD'),
      },
      tls: { rejectUnauthorized: false },
    });
  }

  async sendShiftConfirmation(opts: {
    to: string;
    fullname: string;
    shiftDate: string;
    shiftName: string;
    position: string;
    token: string;
  }) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const confirmUrl = `${frontendUrl}/api/confirm-shift?token=${opts.token}`;

    await this.send({
      to: opts.to,
      subject: `[VMS] Xác nhận ca trực – ${opts.shiftDate}`,
      html: `
        <p>Xin chào <strong>${opts.fullname}</strong>,</p>
        <p>Bạn đã được xếp vào ca trực sau:</p>
        <ul>
          <li><strong>Ngày:</strong> ${opts.shiftDate}</li>
          <li><strong>Ca:</strong> ${opts.shiftName}</li>
          <li><strong>Địa điểm:</strong> ${opts.position}</li>
        </ul>
        <p>Vui lòng xác nhận tham gia bằng cách nhấn vào nút bên dưới:</p>
        <a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;">
          Xác nhận ca trực
        </a>
        <p style="color:#666;margin-top:20px;font-size:12px;">
          Nếu bạn không thể tham gia, vui lòng liên hệ BNS để sắp xếp lại.
        </p>
      `,
    });
  }

  async sendShiftReminder(opts: {
    to: string;
    fullname: string;
    shiftDate: string;
    shiftName: string;
    startTime: string;
    position: string;
  }) {
    await this.send({
      to: opts.to,
      subject: `[VMS] Nhắc nhở: Bạn có ca trực vào lúc ${opts.startTime}`,
      html: `
        <p>Xin chào <strong>${opts.fullname}</strong>,</p>
        <p>Đây là nhắc nhở ca trực của bạn trong vòng 2 giờ:</p>
        <ul>
          <li><strong>Ngày:</strong> ${opts.shiftDate}</li>
          <li><strong>Ca:</strong> ${opts.shiftName} (${opts.startTime})</li>
          <li><strong>Địa điểm:</strong> ${opts.position}</li>
        </ul>
        <p>Đừng quên check-in khi đến nhé!</p>
      `,
    });
  }

  async sendRequestNotification(opts: {
    to: string;
    fullname: string;
    senderName: string;
    type: 'SWAP' | 'SUBSTITUTE';
    shiftDate: string;
    shiftName: string;
  }) {
    const typeLabel = opts.type === 'SWAP' ? 'đổi ca' : 'trông hộ';
    await this.send({
      to: opts.to,
      subject: `[VMS] Yêu cầu ${typeLabel} từ ${opts.senderName}`,
      html: `
        <p>Xin chào <strong>${opts.fullname}</strong>,</p>
        <p><strong>${opts.senderName}</strong> muốn ${typeLabel} với bạn:</p>
        <ul>
          <li><strong>Ca:</strong> ${opts.shiftName} ngày ${opts.shiftDate}</li>
        </ul>
        <p>Vui lòng đăng nhập hệ thống để xem và phản hồi yêu cầu.</p>
      `,
    });
  }

  async sendShiftAssignmentEmail(opts: {
    to: string;
    fullname: string;
    shifts: Array<{
      registrationId: number;
      shiftDate: string;
      shiftName: string;
      positionLabel: string;
      startTimeLabel: string;
      endTimeLabel: string;
      startDateTimeUtc: Date;
      endDateTimeUtc: Date;
    }>;
  }) {
    for (const shift of opts.shifts) {
      const icsContent = this.buildIcsContent([shift]);

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
          <h2 style="color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px;">
            [VMS] Ca trực đã được xác nhận
          </h2>
          <p>Xin chào <strong>${opts.fullname}</strong>,</p>
          <p>Ca trực sau đây của bạn đã được BNS xác nhận:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#1e40af;color:#fff;">
                <th style="padding:10px 14px;text-align:left;">Ngày</th>
                <th style="padding:10px 14px;text-align:left;">Ca trực</th>
                <th style="padding:10px 14px;text-align:left;">Thời gian</th>
                <th style="padding:10px 14px;text-align:left;">Địa điểm</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#f1f5f9;">
                <td style="padding:10px 14px;">${shift.shiftDate}</td>
                <td style="padding:10px 14px;">${shift.shiftName}</td>
                <td style="padding:10px 14px;">${shift.startTimeLabel} – ${shift.endTimeLabel}</td>
                <td style="padding:10px 14px;">${shift.positionLabel}</td>
              </tr>
            </tbody>
          </table>
          <p style="color:#666;font-size:12px;margin-top:16px;">
            Mở file đính kèm <em>ca-truc.ics</em> để thêm ca trực vào ứng dụng lịch của bạn.
          </p>
          <p style="color:#666;font-size:12px;">
            Nếu có thay đổi, vui lòng liên hệ BNS sớm nhất có thể.
          </p>
        </div>
      `;

      await this.send({
        to: opts.to,
        subject: `[VMS] Ca trực đã xác nhận – ${shift.shiftDate} ${shift.shiftName}`,
        html,
        attachments: [
          {
            filename: 'ca-truc.ics',
            content: icsContent,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ],
      });
    }
  }

  private buildIcsContent(
    shifts: Array<{
      registrationId: number;
      shiftName: string;
      positionLabel: string;
      startDateTimeUtc: Date;
      endDateTimeUtc: Date;
    }>,
  ): string {
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace('.000', '');

    const now = fmt(new Date());

    const events = shifts.map((s) =>
      [
        'BEGIN:VEVENT',
        `UID:vms-shift-${s.registrationId}@vms.system`,
        `DTSTAMP:${now}`,
        `DTSTART:${fmt(s.startDateTimeUtc)}`,
        `DTEND:${fmt(s.endDateTimeUtc)}`,
        `SUMMARY:Ca trực VMS – ${s.shiftName}`,
        `DESCRIPTION:Ca trực tại ${s.positionLabel}`,
        `LOCATION:${s.positionLabel}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ].join('\r\n'),
    );

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ban Nhân Sự//VN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  private async send(opts: {
    to: string;
    subject: string;
    html: string;
    attachments?: { filename: string; content: string; contentType: string }[];
  }) {
    try {
      await this.transporter.sendMail({
        from: `"Ban Nhân Sự" <${this.configService.get('GMAIL_USER')}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments,
      });
    } catch (err) {
      this.logger.warn(`Failed to send email to ${opts.to}: ${err.message}`);
    }
  }
}
