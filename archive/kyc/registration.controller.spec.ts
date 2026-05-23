import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from '../services/registration.service';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { RetryVerificationDto } from '../dto/retry-verification.dto';
import type { KycResponse } from '../interfaces/kyc-response.interface';

describe('RegistrationController', () => {
  let controller: RegistrationController;
  // Mockeamos SOLO lo que usamos del service, con tipos fuertes (nada de any)
  type ServiceMock = jest.Mocked<
    Pick<
      RegistrationService,
      'startRegistration' | 'getStatus' | 'retryVerification'
    >
  >;
  let service: ServiceMock;

  // Instancia de mock concreta, sin `as any`
  const mockRegistrationService: ServiceMock = {
    startRegistration: jest.fn(),
    getStatus: jest.fn(),
    retryVerification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationController],
      providers: [
        { provide: RegistrationService, useValue: mockRegistrationService },
      ],
    }).compile();

    controller = module.get<RegistrationController>(RegistrationController);
    service = module.get(RegistrationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /registro/creadora', () => {
    it('debe llamar a startRegistration y devolver su resultado', async () => {
      // Si no querés completar el DTO, casteá desde unknown (no dispara no-unsafe-*):
      const dto = {} as unknown as CreateCreatorDto;

      const kycResp: KycResponse = {
        status: 'pending',
        message: 'Proceso iniciado',
        userId: 'abc',
      };

      // Evita unbound-method: trabajá con el spy
      const startSpy = jest
        .spyOn(service, 'startRegistration')
        .mockResolvedValueOnce(kycResp);

      const result = await controller.register(dto);

      expect(startSpy).toHaveBeenCalledWith(dto);
      expect(result).toBe(kycResp);
    });
  });

  describe('GET /registro/kyc/estado/:id', () => {
    it('debe llamar a getStatus con el id y devolver su resultado', async () => {
      const resp: KycResponse = {
        status: 'verified',
        message: 'Aprobado correctamente',
        userId: 'user-123',
      };

      const getStatusSpy = jest
        .spyOn(service, 'getStatus')
        .mockResolvedValueOnce(resp);

      const result = await controller.getEstado('user-123');

      expect(getStatusSpy).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(resp);
    });
  });

  describe('PUT /registro/kyc/reintento', () => {
    it('debe llamar a retryVerification con los paths y devolver su resultado', async () => {
      const body: RetryVerificationDto = {
        userId: 'u1',
        selfiePath: '/tmp/selfie.jpg',
        photoPath: '/tmp/photo.jpg',
      };

      const retryResp: KycResponse = {
        status: 'rejected',
        message: 'Documentos inválidos',
        userId: 'u1',
      };

      const retrySpy = jest
        .spyOn(service, 'retryVerification')
        .mockResolvedValueOnce(retryResp);

      const result = await controller.retry(body);

      expect(retrySpy).toHaveBeenCalledWith(
        'u1',
        '/tmp/selfie.jpg',
        '/tmp/photo.jpg',
      );
      expect(result).toBe(retryResp);
    });
  });
});
