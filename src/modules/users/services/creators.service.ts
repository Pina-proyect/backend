import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ConflictException('No puedes seguirte a ti mismo');
    }

    const creator = await this.prisma.creator.findUnique({
      where: { id: followingId },
    });
    if (!creator) throw new NotFoundException('Creador no encontrado');

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) return existing;

    return this.prisma.follow.create({
      data: { followerId, followingId },
    });
  }

  async unfollow(followerId: string, followingId: string) {
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (!existing) throw new NotFoundException('No sigues a este creador');

    return this.prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    });
  }

  async getFollowersCount(creatorId: string): Promise<number> {
    return this.prisma.follow.count({
      where: { followingId: creatorId },
    });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return !!follow;
  }
}
