import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SocialMetadataService } from './social-metadata.service';

describe('SocialMetadataService', () => {
  let service: SocialMetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialMetadataService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => '') }, // sin YOUTUBE_API_KEY
        },
      ],
    }).compile();
    service = module.get<SocialMetadataService>(SocialMetadataService);
  });

  it('normaliza URLs de instagram/tiktok/youtube', () => {
    expect(service.normalizeUrl('instagram', 'https://instagram.com/luna')).toBe(
      'https://instagram.com/luna',
    );
    expect(service.normalizeUrl('youtube', 'youtube.com/@luna')).toBe(
      'https://youtube.com/@luna',
    );
  });

  it('devuelve null para URLs inválidas o de otra plataforma', () => {
    expect(service.normalizeUrl('instagram', 'https://facebook.com/x')).toBeNull();
    expect(service.normalizeUrl('youtube', 'not-a-url')).toBeNull();
  });

  it('procesa y omite redes inválidas', async () => {
    const result = await service.process([
      { platform: 'instagram', url: 'https://instagram.com/ok', followers: 10 },
      { platform: 'tiktok', url: 'https://facebook.com/wrong' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe('instagram');
    expect(result[0].followers).toBe(10);
  });
});
