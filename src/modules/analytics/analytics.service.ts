import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(creatorId: string) {
    const [
      totalDonations,
      approvedDonations,
      totalPacks,
      totalFollowers,
      recentDonations,
    ] = await Promise.all([
      this.prisma.donation.aggregate({
        where: { creatorId },
        _sum: { quantity: true },
      }),
      this.prisma.donation.count({
        where: { creatorId, status: 'approved' },
      }),
      this.prisma.contentPack.count({
        where: { creatorId },
      }),
      this.prisma.follow.count({
        where: { followingId: creatorId },
      }),
      this.prisma.donation.findMany({
        where: { creatorId, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          quantity: true,
          amount: true,
          donorName: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalPinas: totalDonations._sum.quantity || 0,
      totalDonationsCount: approvedDonations,
      totalPacks,
      totalFollowers,
      recentDonations,
    };
  }
}
