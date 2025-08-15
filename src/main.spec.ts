import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './main';
import { AppModule } from './app.module';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      useGlobalPipes: jest.fn(),
      setGlobalPrefix: jest.fn(),
      listen: jest.fn(),
    }),
  },
}));

describe('main.ts Bootstrap', () => {
  type AppMock = jest.Mocked<
    Pick<INestApplication, 'useGlobalPipes' | 'setGlobalPrefix' | 'listen'>
  >;

  let mockApp: AppMock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockApp = {
      useGlobalPipes: jest.fn(),
      setGlobalPrefix: jest.fn(),
      listen: jest.fn(),
    };

    jest
      .spyOn(NestFactory, 'create')
      .mockResolvedValue(mockApp as unknown as INestApplication);
  });

  it('should create application', async () => {
    await bootstrap();
    const createSpy = jest.spyOn(NestFactory, 'create');
    expect(createSpy).toHaveBeenCalledWith(AppModule);
  });

  it('should set global prefix', async () => {
    await bootstrap();
    expect(mockApp.setGlobalPrefix).toHaveBeenCalledWith('pina');
  });
});
