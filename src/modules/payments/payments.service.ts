import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private client: MercadoPagoConfig;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const mpToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    this.client = new MercadoPagoConfig({
      accessToken: mpToken || '',
      options: { timeout: 5000 },
    });
  }

  async createPreference(packId: string, userId: string) {
    const pack = await this.prisma.contentPack.findUnique({
      where: { id: packId },
      include: { creator: true },
    });

    if (!pack) throw new Error('Pack no encontrado');

    const preference = new Preference(this.client);

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    const body = {
      items: [
        {
          id: packId,
          title: `Pack de Contenido: ${packId}`,
          unit_price: Number(pack.price),
          quantity: 1,
          currency_id: 'ARS',
        },
      ],
      externalReference: JSON.stringify({ userId, packId }),
      backUrls: {
        success: `${frontendUrl}/payment-status?status=success`,
        failure: `${frontendUrl}/payment-status?status=failure`,
        pending: `${frontendUrl}/payment-status?status=pending`,
      },
      autoReturn: 'approved',
      notificationUrl: this.getWebhookUrl(),
      // Lógica de marketplace_fee (opcional según si es cuenta Marketplace o no)
      // marketplace_fee: Number(pack.price) * 0.07
    };

    try {
      console.log('MP Preference Body:', JSON.stringify(body, null, 2));
      const response = await preference.create({ body });
      return {
        id: response.id,
        init_point: response.init_point,
      };
    } catch (error) {
      console.error('Error creating MP preference:', error);
      throw new Error('Error al conectar con MercadoPago');
    }
  }

  async createDonationPreference(
    creatorId: string,
    quantity: number,
    amount: number,
    message?: string,
    donorName?: string,
    donorId?: string,
    donationId?: string,
  ) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
    });
    if (!creator) throw new Error('Creador no encontrado');
    if (!creator.mpAccessToken)
      throw new Error(
        'Este creador aún no tiene configurada su cuenta de cobro en Mercado Pago.',
      );

    // Pre-completar datos del donante si está logueado (reduce fricción en checkout MP)
    let payerEmail = '';
    let payerName = donorName || '';
    if (donorId) {
      const donor = await this.prisma.creator.findUnique({
        where: { id: donorId },
        select: { email: true, fullName: true },
      });
      if (donor) {
        payerEmail = donor.email || '';
        if (!payerName) payerName = donor.fullName || '';
      }
    }

    // Inicializamos un cliente específico con el token del creador
    const creatorClient = new MercadoPagoConfig({
      accessToken: creator.mpAccessToken,
      options: { timeout: 5000 },
    });
    const preference = new Preference(creatorClient);

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    // Fee del 7% para Pina (Marketplace Fee)
    const fee = amount * 0.07;

    const body = {
      items: [
        {
          id: `donation-${donationId ?? creatorId}`,
          title: `${quantity} Piña(s) para ${creator.fullName}`,
          unit_price: Number(amount),
          quantity: 1,
          currency_id: 'ARS',
        },
      ],
      payer: {
        ...(payerName ? { name: payerName } : {}),
        ...(payerEmail ? { email: payerEmail } : {}),
      },
      metadata: {
        donation_id: donationId,
        creator_id: creatorId,
        quantity,
        amount,
        ...(message ? { message } : {}),
        ...(donorName ? { donor_name: donorName } : {}),
        ...(donorId ? { donor_id: donorId } : {}),
      },
      externalReference: JSON.stringify({
        type: 'DONATION',
        donationId,
        creatorId,
        quantity,
        amount,
        message,
        donorName,
        donorId,
      }),
      backUrls: {
        success: `${frontendUrl}/pina/payment/success`,
        failure: `${frontendUrl}/pina/payment/failure`,
        pending: `${frontendUrl}/pina/payment/pending`,
      },
      autoReturn: 'approved',
      notificationUrl: this.getWebhookUrl(creatorId),
      marketplaceFee: Number(fee.toFixed(2)),
    };

    try {
      const response = await preference.create({ body });
      return {
        id: response.id,
        init_point: response.init_point,
      };
    } catch (error) {
      console.error('Error creating MP donation preference:', error);
      throw new Error('Error al conectar con MercadoPago');
    }
  }

  /**
   * Resuelve la URL de notificación de Mercado Pago.
   * En producción usa BACKEND_URL directamente (ignora NGROK_URL aunque esté seteado).
   * En desarrollo permite NGROK_URL para tuneles locales.
   *
   * Usa el path spec-style /webhooks/mercadopago (commit 6). El path viejo
   * /payments/webhook se mantiene como alias en el controller.
   */
  getWebhookUrl(creatorId?: string): string {
    const backendUrl = this.configService.get<string>(
      'BACKEND_URL',
      'http://localhost:4000',
    );
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const base = isProd
      ? backendUrl
      : this.configService.get<string>('NGROK_URL') || backendUrl;

    const qs = creatorId ? `?creatorId=${creatorId}` : '';
    return `${base}/api/pina/webhooks/mercadopago${qs}`;
  }

  validateWebhookSignature(
    xSignature: string,
    xRequestId: string,
    dataID: string,
  ): boolean {
    const secret = this.configService.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) {
      console.warn(
        '[WEBHOOK] MP_WEBHOOK_SECRET no configurado, rechazando webhook por seguridad',
      );
      return false;
    }

    const parts = xSignature.split(',');
    let ts = '';
    let v1 = '';
    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') v1 = value;
    }
    if (!ts || !v1 || !dataID) return false;

    const tsMs = Number(ts) * 1000;
    if (!Number.isFinite(tsMs)) return false;
    const skew = Math.abs(Date.now() - tsMs);
    if (skew > 5 * 60 * 1000) {
      console.warn(
        `[WEBHOOK] ts fuera de tolerancia (skew=${skew}ms), rechazando`,
      );
      return false;
    }

    const manifest = `id:${dataID};request-id:${xRequestId};ts:${ts};`;
    const computed = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v1));
  }

  async handleWebhook(topic: string, id: string, creatorId?: string) {
    if (topic === 'payment') {
      try {
        // Determine which access token to use
        let accessToken = this.configService.get<string>('MP_ACCESS_TOKEN', '');

        if (creatorId) {
          const creator = await this.prisma.creator.findUnique({
            where: { id: creatorId },
          });
          if (creator && creator.mpAccessToken) {
            accessToken = creator.mpAccessToken;
          }
        }

        const url = `https://api.mercadopago.com/v1/payments/${id}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok)
          return { received: false, error: 'Payment not found' };

        const paymentData = await response.json();
        const paymentIdStr = paymentData.id?.toString();

        // 1) Determinar el donationId de la preference
        //    Fuente principal: metadata.donation_id (commit 4)
        //    Fallback: external_reference.donationId (legacy)
        const extRef = JSON.parse(paymentData.external_reference || '{}');
        const donationId: string | undefined =
          paymentData.metadata?.donation_id ?? extRef.donationId;

        if (donationId) {
          // Flujo DONATION: la Donation ya existe en DB (commit 2) con status='pending'
          const donation = await this.prisma.donation.findUnique({
            where: { id: donationId },
          });

          if (!donation) {
            console.warn(`[WEBHOOK] donationId=${donationId} not found in DB`);
            return { received: true };
          }

          // Idempotencia: si ya está approved, skip
          if (donation.status === 'approved') {
            console.log(
              `[WEBHOOK] donationId=${donationId} already approved, skipping`,
            );
            return { received: true };
          }

          const newStatus =
            paymentData.status === 'approved'
              ? 'approved'
              : paymentData.status === 'rejected'
                ? 'rejected'
                : 'pending';

          await this.prisma.donation.update({
            where: { id: donationId },
            data: {
              status: newStatus,
              paymentId: paymentIdStr,
            },
          });

          console.log(
            `[WEBHOOK] donationId=${donationId} status=${newStatus} paymentId=${paymentIdStr}`,
          );
          return { received: true };
        }

        // 2) Flujo PACK (legacy, sin donationId)
        if (paymentData.status === 'approved' && extRef.type !== 'DONATION') {
          const { userId, packId } = extRef;
          if (userId && packId) {
            const existingAccess = await this.prisma.access.findFirst({
              where: { userId, packId },
            });

            if (!existingAccess) {
              await this.prisma.access.create({
                data: {
                  userId,
                  packId,
                  type: 'PACK',
                },
              });
              console.log(
                `[WEBHOOK] Pack ${packId} liberado para usuario ${userId}`,
              );
            }
          }
        }
      } catch (error: any) {
        console.error('[WEBHOOK ERROR]', error);
        return { received: false, error: error.message };
      }
    }
    return { received: true };
  }

  /**
   * Genera la URL de autorización OAuth de Mercado Pago
   * Lanza InternalServerErrorException si falta MP_CLIENT_ID o MP_REDIRECT_URI
   */
  getMercadoPagoAuthUrl(creatorId: string): string {
    const clientId = this.configService.get('MP_CLIENT_ID', '');
    const redirectUri = this.configService.get('MP_REDIRECT_URI', '');

    if (!clientId) {
      console.error('[MP OAUTH] MP_CLIENT_ID no configurado en backend');
      throw new Error(
        'MP_CLIENT_ID no configurado en el backend. Pedile al admin que lo agregue en Render env vars.',
      );
    }
    if (!redirectUri) {
      console.error('[MP OAUTH] MP_REDIRECT_URI no configurado en backend');
      throw new Error(
        'MP_REDIRECT_URI no configurado en el backend. Pedile al admin que lo agregue en Render env vars.',
      );
    }

    const encodedRedirect = encodeURIComponent(redirectUri);
    return `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${creatorId}&redirect_uri=${encodedRedirect}`;
  }

  /**
   * Procesa el callback de OAuth de Mercado Pago
   */
  async handleMercadoPagoCallback(
    code: string,
    creatorId: string,
  ): Promise<string> {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const clientSecret = this.configService.get(
      'MP_CLIENT_SECRET',
      this.configService.get('MP_ACCESS_TOKEN', ''),
    );
    const clientId = this.configService.get('MP_CLIENT_ID', '');
    const redirectUri = this.configService.get('MP_REDIRECT_URI', '');

    try {
      const body = new URLSearchParams({
        client_secret: clientSecret,
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.configService.get('MP_ACCESS_TOKEN', '')}`,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `MercadoPago OAuth token error: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();

      // Guardamos las credenciales en la base de datos para el creador
      await this.prisma.creator.update({
        where: { id: creatorId },
        data: {
          mpAccessToken: data.access_token,
          mpRefreshToken: data.refresh_token,
          mpPublicKey: data.public_key,
        },
      });

      return `${frontendUrl}/settings?tab=monetization&connected=success`;
    } catch (error: any) {
      console.error('[MERCADOPAGO OAUTH ERROR]', error);
      return `${frontendUrl}/settings?tab=monetization&connected=error&message=${encodeURIComponent(error.message)}`;
    }
  }

  /**
   * Desvincula la cuenta de Mercado Pago del creador
   */
  async disconnectMercadoPago(creatorId: string) {
    await this.prisma.creator.update({
      where: { id: creatorId },
      data: {
        mpAccessToken: null,
        mpRefreshToken: null,
        mpPublicKey: null,
      },
    });
    return { success: true };
  }

  /**
   * Obtiene el estado de la integración de pagos del creador.
   * Hace un health check a la API de MP para verificar que el token es válido.
   * Si el token expiró o fue revocado, limpia las credenciales automáticamente.
   */
  async getPaymentSettings(creatorId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: { mpAccessToken: true },
    });

    if (!creator?.mpAccessToken) {
      return { isConnected: false, provider: 'mercadopago' };
    }

    try {
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          Authorization: `Bearer ${creator.mpAccessToken}`,
        },
      });

      if (!response.ok) {
        console.warn(
          `[MP HEALTH] Token inválido para creator ${creatorId}, status: ${response.status}. Limpiando credenciales.`,
        );
        await this.disconnectMercadoPago(creatorId);
        return { isConnected: false, provider: 'mercadopago' };
      }

      const data = await response.json();
      const accountName =
        [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
        data.nickname ||
        'Cuenta Mercado Pago';
      const accountEmail = data.email || '';

      return {
        isConnected: true,
        provider: 'mercadopago',
        accountName,
        accountEmail,
      };
    } catch (error: any) {
      console.error('[MP HEALTH] Error verificando token:', error.message);
      return {
        isConnected: true,
        provider: 'mercadopago',
        accountName: 'Cuenta Mercado Pago',
        accountEmail: '',
      };
    }
  }
}
