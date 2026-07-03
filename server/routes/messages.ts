import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { getMemberPermissions } from '../lib/guild';
import { hasPermission, Permission } from '../../shared/permissions';
import { toMessage } from '../lib/serialize';
import { messageInclude } from '../lib/includes';

const router = Router();
router.use(requireAuth);

const DEFAULT_LIMIT = 40;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), 100);
}

async function assertDMParticipant(dmId: string, userId: string) {
  const p = await prisma.dMParticipant.findUnique({ where: { dmChannelId_userId: { dmChannelId: dmId, userId } } });
  if (!p) throw new HttpError(403, 'Not part of this conversation');
}

// Fetch a page of messages (newest first, returned oldest→newest for rendering).
async function fetchPage(where: { channelId?: string; dmChannelId?: string }, cursor: string | undefined, limit: number, viewerId: string) {
  const rows = await prisma.message.findMany({
    where,
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;
  return {
    items: page.reverse().map((m) => toMessage(m, viewerId)),
    hasMore,
    nextCursor,
  };
}

router.get(
  '/channels/:channelId/messages',
  asyncHandler(async (req, res) => {
    const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId } });
    if (!channel) throw new HttpError(404, 'Channel not found');
    const perms = await getMemberPermissions(channel.serverId, req.userId!);
    if (perms === null || !hasPermission(perms, Permission.VIEW_CHANNELS)) throw new HttpError(403, 'Cannot view this channel');
    const page = await fetchPage({ channelId: channel.id }, req.query.cursor as string | undefined, parseLimit(req.query.limit), req.userId!);
    res.json(page);
  }),
);

router.get(
  '/dms/:dmId/messages',
  asyncHandler(async (req, res) => {
    await assertDMParticipant(req.params.dmId, req.userId!);
    const page = await fetchPage({ dmChannelId: req.params.dmId }, req.query.cursor as string | undefined, parseLimit(req.query.limit), req.userId!);
    res.json(page);
  }),
);

export default router;
