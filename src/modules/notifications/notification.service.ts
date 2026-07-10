import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(creatorId: string) {
    return this.prisma.notification.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(data: {
    creatorId: string;
    type: string;
    title: string;
    message?: string;
    link?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async markAsRead(id: string, creatorId: string) {
    return this.prisma.notification.updateMany({
      where: { id, creatorId },
      data: { read: true },
    });
  }

  async getUnreadCount(creatorId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { creatorId, read: false },
    });
  }
}
