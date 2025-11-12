import { Test, TestingModule } from '@nestjs/testing';
import { CreatorRepository } from './creator.repository';
import { PrismaService } from 'prisma/prisma.service';
import type { Creator, Prisma } from '@prisma/client';

describe('CreatorRepository', () => {
  let repository: CreatorRepository;

  // Mock plano de prisma.creator
  const prismaMock = {
    creator: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const prismaServiceMock = prismaMock as unknown as PrismaService;

  const sampleCreator: Creator = {
    id: 'creator-1',
    fullName: 'Juan Perez',
    email: 'juan@example.com',
    password: null,
    phone: null,
    nationalId: '12345678',
    birthDate: new Date('2000-01-01'),
    provider: 'credentials',
    providerId: null,
    verificationStatus: 'pending',
    selfiePath: '/selfie.jpg',
    photoPath: '/photo.jpg',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorRepository,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    repository = module.get(CreatorRepository);
  });

  it('debería estar definido', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('debería delegar en prisma.creator.create y devolver el creador', async () => {
      prismaMock.creator.create.mockResolvedValueOnce(sampleCreator);

      const data: Prisma.CreatorCreateInput = {
        fullName: sampleCreator.fullName,
        email: sampleCreator.email,
        nationalId: sampleCreator.nationalId,
        birthDate: sampleCreator.birthDate,
        verificationStatus: 'pending',
        selfiePath: sampleCreator.selfiePath,
        photoPath: sampleCreator.photoPath,
      };

      prismaMock.creator.create.mockResolvedValueOnce(sampleCreator);

      const result = await repository.create(data);

      expect(prismaMock.creator.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(sampleCreator);
    });

    it('debería propagar errores de prisma', async () => {
      prismaMock.creator.create.mockRejectedValueOnce(new Error('DB error'));

      const validInput: Prisma.CreatorCreateInput = {
        fullName: 'X',
        email: 'x@y.com',
        nationalId: '99999999',
        birthDate: new Date('1990-01-01'),
        verificationStatus: 'pending',
        selfiePath: '/s.jpg',
        photoPath: '/p.jpg',
      };

      await expect(repository.create(validInput)).rejects.toThrow('DB error');
    });
  });

  describe('findByEmail', () => {
    it('debería llamar a findUnique con where.email y devolver el resultado', async () => {
      prismaMock.creator.findUnique.mockResolvedValueOnce(sampleCreator);

      const result = await repository.findByEmail('juan@example.com');

      expect(prismaMock.creator.findUnique).toHaveBeenCalledWith({
        where: { email: 'juan@example.com' },
      });
      expect(result).toEqual(sampleCreator);
    });

    it('debería devolver null si no existe', async () => {
      prismaMock.creator.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findByEmail('no@existe.com');

      expect(result).toBeNull();
    });
  });

  describe('findByDni', () => {
    it('debería llamar a findUnique con where.nationalId', async () => {
      prismaMock.creator.findUnique.mockResolvedValueOnce(sampleCreator);

      const result = await repository.findByDni('12345678');

      expect(prismaMock.creator.findUnique).toHaveBeenCalledWith({
        where: { nationalId: '12345678' },
      });
      expect(result).toEqual(sampleCreator);
    });
  });
  describe('findById', () => {
    it('debería llamar a findUnique con where.id', async () => {
      prismaMock.creator.findUnique.mockResolvedValueOnce(sampleCreator);

      const result = await repository.findById('creator-1');

      expect(prismaMock.creator.findUnique).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
      });
      expect(result).toEqual(sampleCreator);
    });
  });

  describe('updateVerification', () => {
    it('debería llamar a update con where.id y data parcial', async () => {
      const updated: Creator = {
        ...sampleCreator,
        verificationStatus: 'verified',
      };
      prismaMock.creator.update.mockResolvedValueOnce(updated);

      const result = await repository.updateVerification('creator-1', {
        verificationStatus: 'verified',
        selfiePath: '/new-selfie.jpg',
      } as Partial<Creator>);

      expect(prismaMock.creator.update).toHaveBeenCalledWith({
        where: { id: 'creator-1' },
        data: {
          verificationStatus: 'verified',
          selfiePath: '/new-selfie.jpg',
        },
      });
      expect(result).toEqual(updated);
    });

    it('debería propagar errores de prisma en update', async () => {
      prismaMock.creator.update.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        repository.updateVerification('creator-1', {
          verificationStatus: 'rejected',
        }),
      ).rejects.toThrow('DB down');
    });
  });
});
