import { PrismaClient, Media } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Plan de migración: mapea las filas de Media cuyo url es local (/uploads/...)
 * a object keys de R2 (media/<uuid>.<ext>) preservando el tipo.
 * Lógica pura y testable (no toca red ni disco).
 */
export interface MigrationPlanRow {
  id: string;
  oldUrl: string;
  newKey: string;
  bucket: 'private' | 'public';
}

export function buildPlan(
  rows: Pick<Media, 'id' | 'url' | 'type' | 'mimetype'>[],
): MigrationPlanRow[] {
  return rows
    .filter((r) => r.url.startsWith('/uploads/'))
    .map((r) => {
      const filename = r.url.replace('/uploads/', '');
      const ext = filename.includes('.')
        ? filename.slice(filename.lastIndexOf('.'))
        : '';
      return {
        id: r.id,
        oldUrl: r.url,
        newKey: `media/${r.id}${ext}`,
        bucket: r.type === 'video' ? 'private' : 'public',
      };
    });
}

/** Lee las filas locales pendientes de migración. */
export async function fetchLocalRows(): Promise<
  Pick<Media, 'id' | 'url' | 'type' | 'mimetype'>[]
> {
  return prisma.media.findMany({
    where: { url: { startsWith: '/uploads/' } },
    select: { id: true, url: true, type: true, mimetype: true },
  });
}

/**
 * Runner principal de migración uploads/ → R2.
 * Uso: yarn migrate:r2 [--dry-run]
 * Idempotente: solo migra filas con url /uploads/; nunca borra archivos locales.
 */
export async function runMigration(dryRun = false) {
  const rows = await fetchLocalRows();
  const plan = buildPlan(rows);
  const rollback: MigrationPlanRow[] = [];
  let moved = 0;

  console.log(`Migración de almacenamiento local → R2`);
  console.log(`Filas con /uploads/: ${plan.length}`);
  if (plan.length === 0) {
    console.log('Nada que migrar.');
    return { moved: 0 };
  }

  const { R2StorageService } =
    await import('../src/modules/storage/r2-storage.service');
  const { ConfigService } = await import('@nestjs/config');
  const config = new ConfigService(process.env);
  const storage = new R2StorageService(config);

  for (const item of plan) {
    const fs = await import('fs-extra');
    const path = await import('path');
    const localPath = path.join(process.cwd(), item.oldUrl);
    if (!(await fs.pathExists(localPath))) {
      console.warn(`  [skip] no existe local: ${item.oldUrl}`);
      continue;
    }
    const buffer = await fs.readFile(localPath);
    if (dryRun) {
      console.log(
        `  [dry-run] ${item.oldUrl} → ${item.newKey} (${item.bucket})`,
      );
      continue;
    }
    try {
      const media = await prisma.media.findUnique({ where: { id: item.id } });
      const type = media?.type === 'video' ? 'video' : 'image';
      const uploaded = await storage.upload(buffer, {
        filename: item.newKey.split('/').pop() ?? 'file',
        mimetype: media?.mimetype ?? 'application/octet-stream',
        type,
      });
      const newUrl = type === 'video' ? item.newKey : uploaded;
      await prisma.media.update({
        where: { id: item.id },
        data: { url: newUrl },
      });
      rollback.push(item);
      moved++;
      console.log(`  [ok] ${item.oldUrl} → ${newUrl}`);
    } catch (e) {
      console.error(
        `  [error] ${item.oldUrl}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (!dryRun) {
    console.log(`\nMigrados: ${moved}/${plan.length}`);
    console.log('Rollback JSON:', JSON.stringify(rollback, null, 2));
  } else {
    console.log('\n[dry-run] No se realizaron cambios.');
  }
  return { moved, dryRun, plan: plan.length };
}

// CLI entry
const isMain = require.main === module;
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  runMigration(dryRun)
    .then((r) => {
      console.log('Resultado:', r);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('Migración falló:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
