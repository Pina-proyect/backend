import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  StorageOptions,
  StorageProvider,
  ResolvedUrl,
} from './storage.provider';

const MIN_TTL = 600; // 10 min
const MAX_TTL = 1800; // 30 min
const DEFAULT_TTL = 1800;

/**
 * Almacenamiento Cloudflare R2 (S3-compatible).
 * - videos → bucket privado, se sirven por URL presignada (inline, TTL clamp 600-1800s)
 * - images → bucket público, se sirven por URL pública persistente
 */
@Injectable()
export class R2StorageService extends StorageProvider {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client;
  private readonly privateBucket: string;
  private readonly publicBucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    super();
    const accountId = config.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    const endpoint =
      config.get<string>('R2_ENDPOINT') ??
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.privateBucket = config.get<string>('R2_BUCKET') ?? 'pina-private';
    this.publicBucket = config.get<string>('R2_PUBLIC_BUCKET') ?? 'pina-public';
    this.publicUrl = (config.get<string>('R2_PUBLIC_URL') ?? '').replace(
      /\/$/,
      '',
    );
  }

  private keyFor(filename: string): string {
    const ext = extname(filename) || '';
    return `media/${randomUUID()}${ext}`;
  }

  async upload(file: Buffer, options: StorageOptions): Promise<string> {
    const key = this.keyFor(options.filename);
    const isVideo = options.type === 'video';
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: isVideo ? this.privateBucket : this.publicBucket,
          Key: key,
          Body: file,
          ContentType: options.mimetype,
        }),
      );
      return isVideo ? key : `${this.publicUrl}/${key}`;
    } catch (e) {
      this.logger.error(
        `Error al subir archivo a R2: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new InternalServerErrorException('Error al subir el archivo');
    }
  }

  async delete(urlOrKey: string): Promise<void> {
    try {
      let bucket: string;
      let key: string;
      if (urlOrKey.startsWith('media/')) {
        // key privada
        bucket = this.privateBucket;
        key = urlOrKey;
      } else if (this.publicUrl && urlOrKey.startsWith(this.publicUrl)) {
        // URL pública → derivar key
        bucket = this.publicBucket;
        key = urlOrKey.slice(this.publicUrl.length + 1);
      } else {
        // referencia desconocida (ej. /uploads/legacy) → no-op
        this.logger.warn(`delete ignorado (referencia no R2): ${urlOrKey}`);
        return;
      }
      await this.client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/NoSuchKey|404/i.test(msg)) {
        // idempotente: el objeto ya no existe
        this.logger.warn(`delete idempotente: ${urlOrKey} no existe`);
        return;
      }
      this.logger.error(`Error al borrar en R2: ${msg}`);
      throw new InternalServerErrorException('Error al borrar el archivo');
    }
  }

  async getUrl(key: string, ttlSeconds?: number): Promise<ResolvedUrl> {
    const ttl = Math.min(MAX_TTL, Math.max(MIN_TTL, ttlSeconds ?? DEFAULT_TTL));
    try {
      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.privateBucket,
          Key: key,
          ResponseContentDisposition: 'inline',
        }),
        { expiresIn: ttl },
      );
      return {
        url,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      };
    } catch (e) {
      this.logger.error(
        `Error al generar URL presignada: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new InternalServerErrorException(
        'Error al generar la URL del archivo',
      );
    }
  }
}
