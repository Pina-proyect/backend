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
    expect(
      service.normalizeUrl('instagram', 'https://instagram.com/luna'),
    ).toBe('https://instagram.com/luna');
    expect(service.normalizeUrl('youtube', 'youtube.com/@luna')).toBe(
      'https://youtube.com/@luna',
    );
  });

  it('devuelve null para URLs inválidas o de otra plataforma', () => {
    expect(
      service.normalizeUrl('instagram', 'https://facebook.com/x'),
    ).toBeNull();
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

  describe('enrichYouTube (Data API v3)', () => {
    it('enriquece con stats del canal si hay API key', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                statistics: {
                  subscriberCount: '5000',
                  viewCount: '120000',
                  videoCount: '42',
                },
              },
            ],
          }),
      });
      global.fetch = fetchMock;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SocialMetadataService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => 'youtube-test-key') },
          },
        ],
      }).compile();
      const svc = module.get<SocialMetadataService>(SocialMetadataService);

      const enriched = await svc.enrichYouTube({
        platform: 'youtube',
        url: 'https://youtube.com/@luna',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(enriched.stats).toEqual({
        subscriberCount: '5000',
        viewCount: '120000',
        videoCount: '42',
      });
      expect(enriched.followers).toBe(5000);
    });

    it('no enriquece si la API responde error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SocialMetadataService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn(() => 'youtube-test-key') },
          },
        ],
      }).compile();
      const svc = module.get<SocialMetadataService>(SocialMetadataService);

      const enriched = await svc.enrichYouTube({
        platform: 'youtube',
        url: 'https://youtube.com/@luna',
      });

      expect(enriched.followers).toBeUndefined();
      expect(enriched.stats).toBeUndefined();
    });
  });
});
