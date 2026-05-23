import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const creator = await prisma.creator.findFirst({
    where: {
        slug: { not: null }
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (creator) {
    console.log(`FOUND_SLUG:${creator.slug}`);
    console.log(`FULL_NAME:${creator.fullName}`);
  } else {
    // Check if any creator exists
    const anyCreator = await prisma.creator.findFirst({ orderBy: { createdAt: 'desc' } });
    if (anyCreator) {
        console.log(`CREATOR_FOUND_BUT_NO_SLUG:${anyCreator.fullName} (ID: ${anyCreator.id})`);
    } else {
        console.log('NO_CREATORS_AT_ALL');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
