import { buildPlan } from '../../../scripts/migrate-r2';

describe('buildPlan (migración uploads → R2)', () => {
  it('mapea filas con url /uploads/ a object keys media/<id>.<ext>', () => {
    const plan = buildPlan([
      {
        id: 'v1',
        url: '/uploads/video-1.mp4',
        type: 'video',
        mimetype: 'video/mp4',
      },
      {
        id: 'i1',
        url: '/uploads/cover.png',
        type: 'image',
        mimetype: 'image/png',
      },
    ]);

    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      id: 'v1',
      oldUrl: '/uploads/video-1.mp4',
      newKey: 'media/v1.mp4',
      bucket: 'private',
    });
    expect(plan[1]).toEqual({
      id: 'i1',
      oldUrl: '/uploads/cover.png',
      newKey: 'media/i1.png',
      bucket: 'public',
    });
  });

  it('ignora filas que ya no usan /uploads/', () => {
    const plan = buildPlan([
      {
        id: 'r2-1',
        url: 'media/r2-1.mp4',
        type: 'video',
        mimetype: 'video/mp4',
      },
      {
        id: 'pub-1',
        url: 'https://pub.example.com/media/pub-1.png',
        type: 'image',
        mimetype: 'image/png',
      },
    ]);
    expect(plan).toHaveLength(0);
  });

  it('maneja extensiones con puntos múltiples y sin extensión', () => {
    const plan = buildPlan([
      {
        id: 'x',
        url: '/uploads/video.v2.mp4',
        type: 'video',
        mimetype: 'video/mp4',
      },
      {
        id: 'y',
        url: '/uploads/noext',
        type: 'image',
        mimetype: 'image/png',
      },
    ]);
    expect(plan[0].newKey).toBe('media/x.mp4');
    expect(plan[1].newKey).toBe('media/y');
  });
});
