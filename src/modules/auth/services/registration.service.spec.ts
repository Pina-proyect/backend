import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationService } from './registration.service';
import { CreatorRepository } from '../repositories/creator.repository';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

type MockCreatorRepository = Required<jest.Mocked<CreatorRepository>>;

describe('RegistrationService', () => {
  let service: RegistrationService;
  let creatorRepository: MockCreatorRepository;

  const mockCreateCreatorDto: CreateCreatorDto = {
    fullName: 'Juan Perez',
    email: 'juan.perez@example.com',
    nationalId: '123456789',
    birthDate: '2000-01-01',
    selfiePath: 'path/to/selfie.jpg',
    photoPath: 'path/to/photo.jpg',
  };

  const mockCreator = {
    id: 'creator-id-123',
    ...mockCreateCreatorDto,
    birthDate: new Date(mockCreateCreatorDto.birthDate),
    verificationStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    password: null,
    phone: null,
    provider: 'credentials',
    providerId: null,
    tokenVersion: 0,
  };

  beforeEach(async () => {
    const creatorRepositoryMock: MockCreatorRepository = {
      findByEmail: jest.fn(),
      findByDni: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      updateVerification: jest.fn(),
      findByProvider: jest.fn(),
      incrementTokenVersion: jest.fn(),
      findBySlug: jest.fn(),
      update: jest.fn(),
      search: jest.fn(),
      findByResetToken: jest.fn(),
      findByVerificationToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        {
          provide: CreatorRepository,
          useValue: creatorRepositoryMock,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<RegistrationService>(RegistrationService);
    creatorRepository = module.get<CreatorRepository>(
      CreatorRepository,
    ) as unknown as MockCreatorRepository;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('CreatorRepository mock should be defined', () => {
    expect(creatorRepository).toBeDefined();
  });

  describe('startRegistration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException if age is less than 18', async () => {
      const youngCreatorDto = {
        ...mockCreateCreatorDto,
        birthDate: '2010-01-01',
      };
      await expect(service.startRegistration(youngCreatorDto)).rejects.toThrow(
        new BadRequestException(
          'Debes tener al menos 18 años para registrarte.',
        ),
      );
      expect(creatorRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      creatorRepository.findByEmail.mockResolvedValue(mockCreator as any);

      await expect(
        service.startRegistration(mockCreateCreatorDto),
      ).rejects.toThrow(
        new BadRequestException(
          `Ya existe un creador registrado con el email ${mockCreateCreatorDto.email}`,
        ),
      );
      expect(creatorRepository.findByEmail).toHaveBeenCalledWith(
        mockCreateCreatorDto.email,
      );
      expect(creatorRepository.findByDni).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if DNI already exists', async () => {
      creatorRepository.findByEmail.mockResolvedValue(null);
      creatorRepository.findByDni.mockResolvedValue(mockCreator as any);

      await expect(
        service.startRegistration(mockCreateCreatorDto),
      ).rejects.toThrow(
        new BadRequestException(
          `Ya existe un creador registrado con el DNI ${mockCreateCreatorDto.nationalId}`,
        ),
      );
      expect(creatorRepository.findByEmail).toHaveBeenCalledWith(
        mockCreateCreatorDto.email,
      );
      expect(creatorRepository.findByDni).toHaveBeenCalledWith(
        mockCreateCreatorDto.nationalId,
      );
      expect(creatorRepository.create).not.toHaveBeenCalled();
    });

    it('should successfully start registration and return pending status', async () => {
      creatorRepository.findByEmail.mockResolvedValue(null);
      creatorRepository.findByDni.mockResolvedValue(null);
      creatorRepository.create.mockResolvedValue(mockCreator as any);

      const result = await service.startRegistration(mockCreateCreatorDto);

      expect(creatorRepository.findByEmail).toHaveBeenCalledWith(
        mockCreateCreatorDto.email,
      );
      expect(creatorRepository.findByDni).toHaveBeenCalledWith(
        mockCreateCreatorDto.nationalId,
      );
      expect(creatorRepository.create).toHaveBeenCalled();

      const calledInput = creatorRepository.create.mock.calls[0][0];
      expect(calledInput.birthDate).toBeInstanceOf(Date);
      expect(calledInput).toMatchObject({
        fullName: mockCreateCreatorDto.fullName,
        email: mockCreateCreatorDto.email,
        nationalId: mockCreateCreatorDto.nationalId,
        verificationStatus: 'pending',
        selfiePath: mockCreateCreatorDto.selfiePath,
        photoPath: mockCreateCreatorDto.photoPath,
        password: null,
      });

      expect(result).toEqual({
        status: 'pending',
        message: 'Registro completado. Tu cuenta se encuentra en proceso de verificación.',
        userId: mockCreator.id,
      });
    });

    it('should hash password when provided and persist hashed value', async () => {
      creatorRepository.findByEmail.mockResolvedValue(null);
      creatorRepository.findByDni.mockResolvedValue(null);
      creatorRepository.create.mockResolvedValue(mockCreator as any);

      const dtoWithPassword = {
        ...mockCreateCreatorDto,
        password: 'SuperSecret123',
      } as any;

      await service.startRegistration(dtoWithPassword);

      const calledInput = creatorRepository.create.mock.calls[0][0];
      expect(typeof calledInput.password).toBe('string');
      expect(calledInput.password).not.toBe(dtoWithPassword.password);
      expect(calledInput.password).toMatch(/^\$2[aby?]\$/);
    });
  });
});
