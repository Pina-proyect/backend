import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PackAccessGuard } from './pack-access.guard';
import { PacksService } from '../packs.service';

describe('PackAccessGuard', () => {
  let guard: PackAccessGuard;
  let packsService: any;

  const mockPacksService = {
    getPackById: jest.fn(),
    hasAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackAccessGuard,
        {
          provide: PacksService,
          useValue: mockPacksService,
        },
      ],
    }).compile();

    guard = module.get<PackAccessGuard>(PackAccessGuard);
    packsService = module.get(PacksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user: any,
    params: any,
  ): ExecutionContext => {
    const mockRequest = {
      user,
      params,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw ForbiddenException if user is not present in request', async () => {
    const context = createMockExecutionContext(null, { id: 'pack-123' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Debes iniciar sesión para acceder a este contenido.',
      ),
    );
  });

  it('should throw NotFoundException if pack id is not present in params', async () => {
    const context = createMockExecutionContext({ id: 'user-123' }, {});

    await expect(guard.canActivate(context)).rejects.toThrow(
      new NotFoundException('ID del paquete no especificado en la ruta.'),
    );
  });

  it('should throw NotFoundException if pack does not exist', async () => {
    const context = createMockExecutionContext(
      { id: 'user-123' },
      { id: 'pack-123' },
    );
    packsService.getPackById.mockResolvedValue(null as any);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new NotFoundException('Paquete de contenido no encontrado.'),
    );
  });

  it('should throw ForbiddenException if user does not have access', async () => {
    const context = createMockExecutionContext(
      { id: 'user-123' },
      { id: 'pack-123' },
    );
    packsService.getPackById.mockResolvedValue({ id: 'pack-123' } as any);
    packsService.hasAccess.mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'No tienes acceso a este paquete de contenido. Adquiérelo para desbloquearlo.',
      ),
    );
    expect(packsService.hasAccess).toHaveBeenCalledWith('user-123', 'pack-123');
  });

  it('should return true if user has access', async () => {
    const context = createMockExecutionContext(
      { id: 'user-123' },
      { id: 'pack-123' },
    );
    packsService.getPackById.mockResolvedValue({ id: 'pack-123' } as any);
    packsService.hasAccess.mockResolvedValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(packsService.hasAccess).toHaveBeenCalledWith('user-123', 'pack-123');
  });
});
