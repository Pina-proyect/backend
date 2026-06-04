import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY no configurada — emails no se enviarán');
    }
    this.from = this.configService.get<string>('EMAIL_FROM') || 'Pina <noreply@pina.com>';
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/auth/verify-email?token=${token}`;

    await this.sendEmail(to, 'Verifica tu email en Pina', `Haz clic para verificar tu email: ${link}`);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/auth/reset-password?token=${token}`;

    await this.sendEmail(to, 'Restablece tu contraseña en Pina', `Haz clic para restablecer tu contraseña: ${link}`);
  }

  private async sendEmail(to: string, subject: string, text: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`Email no enviado (sin API key). To: ${to}, Subject: ${subject}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      text,
    });

    if (error) {
      this.logger.error(`Error enviando email a ${to}: ${error.message}`);
    } else {
      this.logger.log(`Email enviado a ${to}: ${subject}`);
    }
  }
}
