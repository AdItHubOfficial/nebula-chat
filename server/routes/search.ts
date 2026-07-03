import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';
import { toMessage, toPublicUser, toServerSummary, toChannel } from '../lib/serialize';
import { messageInclude } from '../lib/includes';

const router = Router();
router.use(requireAuth);

async function memberServerIds(userId: string): Promise<string[]> {
  const memberships = await prisma.serverMember.findMany({ where: { userId }, select: { serverId: true } });
  return memberships.map((m) => m.serverId);
}

// Message search scoped to a channel, a server, or everything the user can see.
router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ items: [] });

    const channelId = req.query.channelId as string | undefined;
    const serverId = req.query.serverId as string | undefined;
    const fromUserId = req.query.from as string | undefined;
    const hasAttachment = req.query.hasAttachment === 'true';

    let channelIds: string[];
    if (channelId) {
      channelIds = [channelId];
    } else {
      const serverIds = serverId ? [serverId] : await memberServerIds(userId);
      const channels = await prisma.channel.findMany({ where: { serverId: { in: serverIds } }, select: { id: true } });
      channelIds = channels.map((c) => c.id);
    }

    // Only search servers the user is a member of.
    const allowed = new Set<string>();
    const memberChannels = await prisma.channel.findMany({
      where: { serverId: { in: await memberServerIds(userId) } },
      select: { id: true },
    });
    memberChannels.forEach((c) => allowed.add(c.id));
    channelIds = channelIds.filter((id) => allowed.has(id));

    const messages = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        content: { contains: q },
        ...(fromUserId ? { authorId: fromUserId } : {}),
        ...(hasAttachment ? { attachments: { some: {} } } : {}),
      },
      include: { ...messageInclude, channel: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      items: messages.map((m) => ({
        ...toMessage(m, userId),
        channelName: (m as unknown as { channel?: { name: string } }).channel?.name ?? null,
      })),
    });
  }),
);

// Combined search for the quick switcher (Ctrl/Cmd+K).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ users: [], servers: [], channels: [] });
    const lower = q.toLowerCase();

    const serverIds = await memberServerIds(userId);

    const [users, servers, channels] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ username: { contains: lower } }, { displayName: { contains: q } }] },
        take: 8,
      }),
      prisma.server.findMany({ where: { id: { in: serverIds }, name: { contains: q } }, take: 8 }),
      prisma.channel.findMany({ where: { serverId: { in: serverIds }, name: { contains: lower } }, take: 12 }),
    ]);

    res.json({
      users: users.map(toPublicUser),
      servers: servers.map(toServerSummary),
      channels: channels.map(toChannel),
    });
  }),
);

export default router;
