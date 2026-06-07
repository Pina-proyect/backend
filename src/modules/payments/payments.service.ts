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
      include: { creator: true }
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
          currency_id: 'ARS'
        }
      ],
      externalReference: JSON.stringify({ userId, packId }),
      backUrls: {
        success: `${frontendUrl}/payment-status?status=success`,
        failure: `${frontendUrl}/payment-status?status=failure`,
        pending: `${frontendUrl}/payment-status?status=pending`
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
        init_point: response.init_point
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
    donorId?: string
  ) {
    const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator) throw new Error('Creador no encontrado');
    if (!creator.mpAccessToken) throw new Error('Este creador no tiene MercadoPago configurado');

    // Inicializamos un cliente específico con el token del creador
    const creatorClient = new MercadoPagoConfig({
      accessToken: creator.mpAccessToken,
      options: { timeout: 5000 }
    });
    const preference = new Preference(creatorClient);

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    // Fee del 7% para Pina (Marketplace Fee)
    const fee = amount * 0.07;

    const body = {
      items: [
        {
          id: `donation-${creatorId}`,
          title: `${quantity} Piña(s) para ${creator.fullName}`,
          unit_price: Number(amount),
          quantity: 1,
          currency_id: 'ARS'
        }
      ],
      externalReference: JSON.stringify({ type: 'DONATION', creatorId, quantity, amount, message, donorName, donorId }),
      backUrls: {
        success: `${frontendUrl}/payment-status?status=success`,
        failure: `${frontendUrl}/payment-status?status=failure`,
        pending: `${frontendUrl}/payment-status?status=pending`
      },
      autoReturn: 'approved',
      notificationUrl: this.getWebhookUrl(creatorId),
      marketplaceFee: Number(fee.toFixed(2))
    };

    try {
      const response = await preference.create({ body });
      return {
        id: response.id,
        init_point: response.init_point
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
   */
  getWebhookUrl(creatorId?: string): string {
    const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:4000');
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const base = isProd
      ? backendUrl
      : (this.configService.get<string>('NGROK_URL') || backendUrl);

    const qs = creatorId ? `?creatorId=${creatorId}` : '';
    return `${base}/api/pina/payments/webhook${qs}`;
  }

  validateWebhookSignature(xSignature: string, xRequestId: string, dataID: string): boolean {
    const secret = this.configService.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) return true; // si no hay secret configurado, no validamos

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
      console.warn(`[WEBHOOK] ts fuera de tolerancia (skew=${skew}ms), rechazando`);
      return false;
    }

    const manifest = `id:${dataID};request-id:${xRequestId};ts:${ts};`;
    const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v1));
  }

  async handleWebhook(topic: string, id: string, creatorId?: string) {
    if (topic === 'payment') {
       try {
         // Determine which access token to use
          let accessToken = this.configService.get<string>('MP_ACCESS_TOKEN', '');
         
         if (creatorId) {
           const creator = await this.prisma.creator.findUnique({ where: { id: creatorId } });
           if (creator && creator.mpAccessToken) {
             accessToken = creator.mpAccessToken;
           }
         }

         const url = `https://api.mercadopago.com/v1/payments/${id}`;
         const response = await fetch(url, {
           headers: { 'Authorization': `Bearer ${accessToken}` }
         });

         if (!response.ok) return { received: false, error: 'Payment not found' };
         
         const paymentData = await response.json();

         if (paymentData.status === 'approved') {
           const extRef = JSON.parse(paymentData.external_reference || '{}');
           
           if (extRef.type === 'DONATION') {
              // Es una donación
              const { creatorId, quantity, amount, message, donorName, donorId } = extRef;
              
              // Revisamos si ya procesamos esta donación
              const existingDonation = await this.prisma.donation.findFirst({
                where: { paymentId: paymentData.id.toString() }
              });

              if (!existingDonation) {
                await this.prisma.donation.create({
                  data: {
                    creatorId,
                    amount: Number(amount),
                    quantity: Number(quantity),
                    message: message || null,
                    donorName: donorName || null,
                    donorId: donorId || null,
                    status: 'approved',
                    paymentId: paymentData.id.toString()
                  }
                });
                console.log(`[PAYMENT SUCCESS] Donación de ${quantity} piñas para creador ${creatorId}`);
              }
           } else {
             // Es la compra de un Pack (Flujo original)
             const { userId, packId } = extRef;
             if (userId && packId) {
               const existingAccess = await this.prisma.access.findFirst({
                 where: { userId, packId }
               });

               if (!existingAccess) {
                 await this.prisma.access.create({
                   data: {
                     userId,
                     packId,
                     type: 'PACK'
                   }
                 });
                 console.log(`[PAYMENT SUCCESS] Pack ${packId} liberado para usuario ${userId}`);
               }
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
   */
  getMercadoPagoAuthUrl(creatorId: string): string {
    const clientId = this.configService.get('MP_CLIENT_ID', '');
    const redirectUri = encodeURIComponent(this.configService.get('MP_REDIRECT_URI', ''));
    return `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${creatorId}&redirect_uri=${redirectUri}`;
  }

  /**
   * Procesa el callback de OAuth de Mercado Pago
   */
  async handleMercadoPagoCallback(code: string, creatorId: string): Promise<string> {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const clientSecret = this.configService.get('MP_CLIENT_SECRET', this.configService.get('MP_ACCESS_TOKEN', ''));
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
          'Authorization': `Bearer ${this.configService.get('MP_ACCESS_TOKEN', '')}`,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MercadoPago OAuth token error: ${response.status} - ${errorText}`);
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
}
