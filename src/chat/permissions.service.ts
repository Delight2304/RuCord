import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Simplified permission service.
 * Replace with complete bitmask resolution (server roles + channel overwrites) in production.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccessChannel(userId: string, channelId: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { serverId: true },
    });

    if (!channel) return false;

    const membership = await this.prisma.serverMember.findFirst({
      where: {
        serverId: channel.serverId,
        userId,
      },
      select: { id: true },
    });

    return Boolean(membership);
  }

  async canSendMessage(userId: string, channelId: string): Promise<boolean> {
    // MVP rule: if user is member of server, allow send.
    return this.canAccessChannel(userId, channelId);
  }
}
