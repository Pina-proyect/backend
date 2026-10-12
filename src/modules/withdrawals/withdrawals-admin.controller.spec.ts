import {
  BadRequestException,
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsAdminGuard } from './guards/withdrawals-admin.guard';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsModule } from './withdrawals.module';
import type { WithdrawalView } from './withdrawals.mapper';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { AppModule } from '../../app.module';
import { NotificationModule } from '../notifications/notification.module';

/**
 * HTTP de administración (v1.27, REQ-WD-4): `PATCH /withdrawals/:id/status`
 * protegido por `WithdrawalsAdminGuard` (Bearer timing-safe, fail-closed) y
 * wiring del módulo (`WithdrawalsModule` + `AppModule`).
 */
const ADMIN_TOKEN = 'super-secret-admin-token-1234567890';

function makeView(overrides: Partial<WithdrawalView> = {}): WithdrawalView {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'w-1',
    creatorId: 'creator-1',
    amountCents: 100000,
    currency: 'ARS',
    status: 'approved',
    destinationPlatform: 'mercadopago',
    destinationReference: null,
    evidence: null,
    clientRequestId: 'abc',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Extrae el cuerpo tipado de una respuesta supertest. */
const bodyOf = <T>(res: { body: unknown }): T => res.body as T;

/** Servidor HTTP tipado (evita el `any` de `getHttpServer()`). */
type HttpServer = import('http').Server;

describe('WithdrawalsAdminController — admin (HTTP)', () => {
  let app: INestApplication;
  let server: HttpServer;
  let service: { updateStatus: jest.Mock };

  const configGet = jest.fn((key: string) => {
    if (key === 'WITHDRAWALS_ADMIN_TOKEN') return ADMIN_TOKEN;
    if (key === 'NODE_ENV') return 'test';
    return undefined;
  });

  beforeEach(async () => {
    service = { updateStatus: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawalsAdminController],
      providers: [
        { provide: WithdrawalsService, useValue: service },
        { provide: ConfigService, useValue: { get: configGet } },
        WithdrawalsAdminGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        get: configGet,
      } as unknown as ConfigService),
    );
    await app.init();
    server = app.getHttpServer() as HttpServer;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /withdrawals/:id/status', () => {
    it('200 con el WithdrawalView tras una transición válida', async () => {
      service.updateStatus.mockResolvedValue(
        makeView({ status: 'paid', evidence: 'MP ref 123' }),
      );

      const res = await request(server)
        .patch('/withdrawals/w-1/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'paid', evidence: 'MP ref 123' });

      expect(res.status).toBe(200);
      expect(bodyOf<WithdrawalView>(res)).toMatchObject({
        id: 'w-1',
        status: 'paid',
      });
      expect(service.updateStatus).toHaveBeenCalledWith('w-1', {
        status: 'paid',
        evidence: 'MP ref 123',
      });
    });

    it('401 sin token de administración (fail-closed)', async () => {
      const res = await request(server)
        .patch('/withdrawals/w-1/status')
        .send({ status: 'approved' });

      expect(res.status).toBe(401);
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('401 con token de administración incorrecto', async () => {
      const res = await request(server)
        .patch('/withdrawals/w-1/status')
        .set('Authorization', 'Bearer token-incorrecto-1234567890')
        .send({ status: 'approved' });

      expect(res.status).toBe(401);
      expect(service.updateStatus).not.toHaveBeenCalled();
    });

    it('404 cuando el retiro no existe', async () => {
      service.updateStatus.mockRejectedValue(
        new NotFoundException('Retiro no encontrado'),
      );

      const res = await request(server)
        .patch('/withdrawals/missing/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
      expect(bodyOf<{ message: string }>(res).message).toBe(
        'Retiro no encontrado',
      );
    });

    it('409 con una transición de estado inválida', async () => {
      service.updateStatus.mockRejectedValue(
        new ConflictException('Transición de estado inválida'),
      );

      const res = await request(server)
        .patch('/withdrawals/w-1/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(409);
      expect(bodyOf<{ message: string }>(res).message).toBe(
        'Transición de estado inválida',
      );
    });

    it('400 cuando paid no incluye evidencia', async () => {
      service.updateStatus.mockRejectedValue(
        new BadRequestException('La evidencia es obligatoria para este estado'),
      );

      const res = await request(server)
        .patch('/withdrawals/w-1/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'paid' });

      expect(res.status).toBe(400);
      expect(bodyOf<{ message: string }>(res).message).toBe(
        'La evidencia es obligatoria para este estado',
      );
    });

    it('400 con un status fuera del enum (ValidationPipe)', async () => {
      const res = await request(server)
        .patch('/withdrawals/w-1/status')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ status: 'requested' });

      expect(res.status).toBe(400);
      expect(service.updateStatus).not.toHaveBeenCalled();
    });
  });
});

describe('WithdrawalsModule — wiring de dependencias', () => {
  const controllers = Reflect.getMetadata(
    'controllers',
    WithdrawalsModule,
  ) as unknown[];

  it('registra ambos controladores, el servicio y el guard admin', () => {
    expect(controllers).toEqual(
      expect.arrayContaining([
        WithdrawalsController,
        WithdrawalsAdminController,
      ]),
    );
    const providers = (Reflect.getMetadata('providers', WithdrawalsModule) ??
      []) as unknown[];
    expect(providers).toEqual(
      expect.arrayContaining([WithdrawalsService, WithdrawalsAdminGuard]),
    );
  });

  it('importa NotificationModule para las notificaciones in-app (REQ-WD-5)', () => {
    const imports = (Reflect.getMetadata('imports', WithdrawalsModule) ??
      []) as unknown[];
    expect(imports).toContain(NotificationModule);
  });

  it('AppModule registra WithdrawalsModule', () => {
    const appImports = (Reflect.getMetadata('imports', AppModule) ??
      []) as unknown[];
    expect(appImports).toContain(WithdrawalsModule);
  });
});
