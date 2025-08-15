import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationService } from './registration.service';
import { CreatorRepository } from '../repositories/creator.repository';
import { KycProviderService } from './kycprovider.service';
import { CreateCreatorDto } from '../dto/create-creator.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// --- Mocks para las dependencias ---
// Creamos una interfaz o tipo para los mocks para tener autocompletado y tipado
// Esto es opcional, pero ayuda mucho. Podrías también usar 'jest.Mocked<CreatorRepository>'
type MockCreatorRepository = Required<jest.Mocked<CreatorRepository>>;
type MockKycProviderService = Required<jest.Mocked<KycProviderService>>;

describe('RegistrationService', () => {
  let service: RegistrationService;
  let creatorRepository: MockCreatorRepository; // Usamos el tipo mock
  let kycProvider: MockKycProviderService; // Usamos el tipo mock

  // Datos de prueba comunes
  const mockCreateCreatorDto: CreateCreatorDto = {
    fullName: 'Juan Perez',
    email: 'juan.perez@example.com',
    nationalId: '123456789',
    birthDate: '2000-01-01', // Fecha para ser mayor de 18
    selfiePath: 'path/to/selfie.jpg',
    photoPath: 'path/to/photo.jpg',
  };

  const mockCreator = {
    id: 'creator-id-123',
    ...mockCreateCreatorDto,
    birthDate: new Date(mockCreateCreatorDto.birthDate),
    verificationStatus: 'pending',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    // 1. Define las implementaciones mock de los métodos que tu servicio va a llamar
    // Asegúrate de mockear TODOS los métodos que 'RegistrationService' usa de estas dependencias
    const creatorRepositoryMock: MockCreatorRepository = {
      findByEmail: jest.fn(),
      findByDni: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      updateVerification: jest.fn(),
    };

    const kycProviderServiceMock: MockKycProviderService = {
      verifyDocuments: jest.fn(),
    };

    // 2. Configura el TestingModule
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        {
          provide: CreatorRepository, // Cuando Nest necesite CreatorRepository
          useValue: creatorRepositoryMock, // usa nuestra versión mock
        },
        {
          provide: KycProviderService, // Cuando Nest necesite KycProviderService
          useValue: kycProviderServiceMock, // usa nuestra versión mock
        },
      ],
    }).compile();

    // 3. Obtén las instancias del servicio y los mocks del módulo de prueba
    service = module.get<RegistrationService>(RegistrationService);
    // ¡LA CLAVE ESTÁ AQUÍ! Casteamos a `MockCreatorRepository` directamente.
    creatorRepository = module.get<CreatorRepository>(
      CreatorRepository,
    ) as unknown as MockCreatorRepository;
    kycProvider = module.get<KycProviderService>(
      KycProviderService,
    ) as MockKycProviderService;
  });

  // --- Tests de definición ---
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('CreatorRepository mock should be defined', () => {
    expect(creatorRepository).toBeDefined();
  });

  it('KycProviderService mock should be defined', () => {
    expect(kycProvider).toBeDefined();
  });

  // --- Tests para startRegistration ---
  describe('startRegistration', () => {
    // Limpiamos los mocks antes de cada test dentro de este describe
    // para asegurar que los resultados de un test no afecten a otro
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw BadRequestException if age is less than 18', async () => {
      const youngCreatorDto = {
        ...mockCreateCreatorDto,
        birthDate: '2010-01-01',
      }; // Menor de 18
      await expect(service.startRegistration(youngCreatorDto)).rejects.toThrow(
        new BadRequestException(
          'Debes tener al menos 18 años para registrarte.',
        ),
      );
      // Aseguramos que no se llamaron a los repositorios si falló por edad
      expect(creatorRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      // Configuramos el mock para simular que el email ya existe
      creatorRepository.findByEmail.mockResolvedValue(mockCreator);

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
      expect(creatorRepository.findByDni).not.toHaveBeenCalled(); // No debe llegar aquí
    });

    it('should throw BadRequestException if DNI already exists', async () => {
      // Simulamos que el email no existe, pero el DNI sí
      creatorRepository.findByEmail.mockResolvedValue(null);
      creatorRepository.findByDni.mockResolvedValue(mockCreator);

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
      expect(creatorRepository.create).not.toHaveBeenCalled(); // No debe llegar aquí
    });

    it('should successfully start registration and return pending status', async () => {
      // Configuramos los mocks para un escenario exitoso
      creatorRepository.findByEmail.mockResolvedValue(null);
      creatorRepository.findByDni.mockResolvedValue(null);
      creatorRepository.create.mockResolvedValue(mockCreator);
      creatorRepository.findById.mockResolvedValue(mockCreator); // Para el verifyInBackground
      kycProvider.verifyDocuments.mockResolvedValue('verified'); // Para el verifyInBackground (no await en el test)

      const result = await service.startRegistration(mockCreateCreatorDto);

      expect(creatorRepository.findByEmail).toHaveBeenCalledWith(
        mockCreateCreatorDto.email,
      );
      expect(creatorRepository.findByDni).toHaveBeenCalledWith(
        mockCreateCreatorDto.nationalId,
      );
      expect(creatorRepository.create).toHaveBeenCalledWith({
        fullName: mockCreateCreatorDto.fullName,
        email: mockCreateCreatorDto.email,
        nationalId: mockCreateCreatorDto.nationalId,
        birthDate: expect.any(Date), // Esperamos una instancia de Date
        verificationStatus: 'pending',
        selfiePath: mockCreateCreatorDto.selfiePath,
        photoPath: mockCreateCreatorDto.photoPath,
      });

      expect(result).toEqual({
        status: 'pending',
        message: 'Verification started',
        userId: mockCreator.id,
      });
    });

    it('verifyInBackground debería hacer return si no existe el creator', async () => {
      // Mock: findById devuelve null
      creatorRepository.findById.mockResolvedValue(null);

      // @ts-ignore: forzamos a llamar al método privado para el test
      await service['verifyInBackground']('fake-id');

      expect(creatorRepository.findById).toHaveBeenCalledWith('fake-id');
      expect(kycProvider.verifyDocuments).not.toHaveBeenCalled();
      expect(creatorRepository.updateVerification).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('debería lanzar NotFoundException si el usuario no existe', async () => {
      // Arrange
      creatorRepository.findById.mockResolvedValue(null);

      // Act + Assert
      await expect(service.getStatus('id-inexistente')).rejects.toThrow(
        new NotFoundException('Usuario no encontrado'),
      );

      expect(creatorRepository.findById).toHaveBeenCalledWith('id-inexistente');
      expect(creatorRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('debería devolver el estado cuando el usuario existe', async () => {
      // Arrange
      const existing = {
        ...mockCreator,
        verificationStatus: 'verified', // probamos un valor distinto de 'pending'
      };
      creatorRepository.findById.mockResolvedValue(existing);

      // Act
      const resp = await service.getStatus(existing.id);

      // Assert
      expect(creatorRepository.findById).toHaveBeenCalledWith(existing.id);
      expect(resp).toEqual({
        userId: existing.id,
        status: 'verified',
        message: 'Estado: verified',
      });
    });
  });

  describe('retryVerification', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('debería actualizar el estado a pending, llamar a verifyInBackground y devolver la respuesta', async () => {
      // Arrange
      creatorRepository.updateVerification.mockResolvedValue(undefined as any);

      // Espiamos el método privado verifyInBackground para asegurar que se invoque
      const spyVerify = jest
        .spyOn(service as any, 'verifyInBackground')
        .mockResolvedValue(undefined);

      const userId = 'creator-id-123';
      const selfiePath = '/tmp/selfie.jpg';
      const photoPath = '/tmp/photo.jpg';

      // Act
      const resp = await service.retryVerification(
        userId,
        selfiePath,
        photoPath,
      );

      // Assert
      expect(creatorRepository.updateVerification).toHaveBeenCalledWith(
        userId,
        {
          selfiePath,
          photoPath,
          verificationStatus: 'pending',
        },
      );

      expect(spyVerify).toHaveBeenCalledWith(userId);

      expect(resp).toEqual({
        userId,
        status: 'pending',
        message: 'Nuevo intento de verificación iniciado',
      });
    });

    it('debería propagar el error si updateVerification falla', async () => {
      // Arrange
      creatorRepository.updateVerification.mockRejectedValue(
        new Error('DB down'),
      );

      // Act + Assert
      await expect(
        service.retryVerification('u1', '/s.jpg', '/p.jpg'),
      ).rejects.toThrow('DB down');

      // verifyInBackground no debería llamarse si falla la actualización

      const spyVerify = jest.spyOn(service as any, 'verifyInBackground');
      expect(spyVerify).not.toHaveBeenCalled();
    });
  });
});
