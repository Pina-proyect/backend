import { Test, TestingModule } from '@nestjs/testing';
import { PacksController } from './packs.controller';
import { PacksService } from './packs.service';
import { PackAccessGuard } from './guards/pack-access.guard';

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
        PackAccessGuard,
      ],
    }).compile();

    controller = module.get<PacksController>(PacksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
