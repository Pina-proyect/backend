import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { CreatorRepository } from '../repositories/creator.repository';
import { JwtService } from '@nestjs/jwt';
import type { Creator } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthService login (bcrypt)', () => {
  let service: AuthService;

  type MockRepo = jest.Mocked<Pick<CreatorRepository, 'findByEmail'>>;
  type MockJwt = jest.Mocked<Pick<JwtService, 'sign'>>;

  const repo: MockRepo = {
    findByEmail: jest.fn(),
  } as any;

  const jwt: MockJwt = {
    sign: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CreatorRepository, useValue: repo },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('debería lanzar Unauthorized si el usuario no existe o no tiene password', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    await expect(
      service.login({ email: 'a@b.com', password: 'pw' }),
    ).rejects.toThrow('Credenciales inválidas');

    const userNoPass = {
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      password: null,
      birthDate: new Date(),
      provider: 'credentials',
      providerId: null,
      tokenVersion: 0,
      nationalId: null,
      phone: null,
      verificationStatus: 'pending',
      selfiePath: null,
      photoPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Creator;
    repo.findByEmail.mockResolvedValueOnce(userNoPass);
    await expect(
      service.login({ email: 'a@b.com', password: 'pw' }),
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('debería autenticar cuando bcrypt.compare coincide y emitir tokens', async () => {
    const plain = 'super-secret';
    const hash = await bcrypt.hash(plain, 10);

    const user: Creator = {
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      password: hash,
      birthDate: new Date(),
      provider: 'credentials',
      providerId: null,
      tokenVersion: 0,
      nationalId: null,
      phone: null,
      verificationStatus: 'pending',
      selfiePath: null,
      photoPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Creator;
    repo.findByEmail.mockResolvedValueOnce(user);

    // Mock de sign para tokens deterministas
    jwt.sign.mockImplementation((payload: any) => {
      return typeof payload.tokenVersion !== 'undefined' ? 'REFRESH' : 'ACCESS';
    });

    const resp = await service.login({ email: 'a@b.com', password: plain });
    expect(resp).toEqual({ accessToken: 'ACCESS', refreshToken: 'REFRESH' });
  });

  it('debería lanzar Unauthorized si bcrypt.compare no coincide', async () => {
    const hash = await bcrypt.hash('correct', 10);
    const user: Creator = {
      id: 'u1',
      email: 'a@b.com',
      fullName: 'A B',
      password: hash,
      birthDate: new Date(),
      provider: 'credentials',
      providerId: null,
      tokenVersion: 0,
      nationalId: null,
      phone: null,
      verificationStatus: 'pending',
      selfiePath: null,
      photoPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Creator;
    repo.findByEmail.mockResolvedValueOnce(user);

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow('Credenciales inválidas');
  });
});