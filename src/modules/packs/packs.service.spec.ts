import { Test, TestingModule } from '@nestjs/testing';
import { PacksService } from './packs.service';
import { PrismaService } from 'prisma/prisma.service';

describe('PacksService', () => {
  let service: PacksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PacksService,
        {
          provide: PrismaService,
          useValue: {
            contentPack: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              count: jest.fn(),
            },
            media: {
              count: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
            },
            access: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PacksService>(PacksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
