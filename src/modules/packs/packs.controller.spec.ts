import { Test, TestingModule } from '@nestjs/testing';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';
import { PackAccessGuard } from './guards/pack-access.guard';
import { ConfigService } from '@nestjs/config';
import { MediaUrlResolver } from '../media/media-url.resolver';

describe('PacksController', () => {
  let controller: PacksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PacksController],
      providers: [
        {
          provide: PacksService,
          useValue: {
            createPack: jest.fn(),
            getMyPacks: jest.fn(),
            getAllCategories: jest.fn(),
            getPacksByCreatorSlug: jest.fn(),
            getPackById: jest.fn(),
            grantAccess: jest.fn(),
            hasAccess: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: MediaUrlResolver,
          useValue: {
            resolveItem: jest.fn(),
            resolveItems: jest.fn(),
            toPublicItem: jest.fn(),
            toPublicItems: jest.fn(),
            resolvePacks: jest.fn(),
            toPublicPacks: jest.fn(),
            isNonPublic: jest.fn(),
          },
        },
        PackAccessGuard,
      ],
    }).compile();

    controller = module.get<PacksController>(PacksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
