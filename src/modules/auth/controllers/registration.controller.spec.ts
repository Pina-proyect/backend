import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from '../services/registration.service';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { RetryVerificationDto } from '../dto/retry-verification.dto';

describe('RegistrationController', () => {
  let controller: RegistrationController;
  let service: jest.Mocked<RegistrationService>;

  // Mock del service con Jest
  const mockRegistrationService: jest.Mocked<RegistrationService> = {
    startRegistration: jest.fn(),
    getStatus: jest.fn(),
    retryVerification: jest.fn(),
  } as any;

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
      const dto: CreateCreatorDto = {
        // completa los campos que tengas en tu DTO
      } as any;

      const kycResp = { status: 'PENDING', id: 'abc' } as any;
      service.startRegistration.mockResolvedValueOnce(kycResp);

      const result = await controller.register(dto);

      expect(service.startRegistration).toHaveBeenCalledWith(dto);
      expect(result).toBe(kycResp);
    });
  });

  describe('GET /registro/kyc/estado/:id', () => {
    it('debe llamar a getStatus con el id y devolver su resultado', async () => {
      service.getStatus.mockResolvedValueOnce({ status: 'APPROVED' } as any);

      const result = await controller.getEstado('user-123');

      expect(service.getStatus).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ status: 'APPROVED' });
    });
  });

  describe('PUT /registro/kyc/reintento', () => {
    it('debe llamar a retryVerification con los paths y devolver su resultado', async () => {
      const body: RetryVerificationDto = {
        userId: 'u1',
        selfiePath: '/tmp/selfie.jpg',
        photoPath: '/tmp/photo.jpg',
      };

      const retryResp = { status: 'RETRYING' } as any;
      service.retryVerification.mockResolvedValueOnce(retryResp);

      const result = await controller.retry(body);

      expect(service.retryVerification).toHaveBeenCalledWith(
        'u1',
        '/tmp/selfie.jpg',
        '/tmp/photo.jpg',
      );
      expect(result).toBe(retryResp);
    });
  });
});
