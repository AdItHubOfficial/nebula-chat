import { prisma } from '../db';
import { SocketEvents } from '../../shared/events';
import { toPublicUser } from './serialize';
import { emitToServer, emitToUser } from '../socket/io';

// Push a user's latest public profile / presence to everyone who can see them:
// all servers they belong to, all their friends, and their own sessions.
export async function broadcastUserUpdate(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { select: { serverId: true } },
      friendshipsSent: { where: { status: 'ACCEPTED' }, select: { addresseeId: true } },
      friendshipsRecv: { where: { status: 'ACCEPTED' }, select: { requesterId: true } },
    },
  });
  if (!user) return;

  const dto = toPublicUser(user);
  const payload = { user: dto };

  for (const m of user.memberships) {
    emitToServer(m.serverId, SocketEvents.PRESENCE_UPDATE, payload);
  }
  const friendIds = [
    ...user.friendshipsSent.map((f) => f.addresseeId),
    ...user.friendshipsRecv.map((f) => f.requesterId),
  ];
  for (const fid of friendIds) emitToUser(fid, SocketEvents.PRESENCE_UPDATE, payload);
  emitToUser(userId, SocketEvents.PRESENCE_UPDATE, payload);
}
