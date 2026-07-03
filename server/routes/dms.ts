import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { toDM } from '../lib/serialize';
import { messageInclude } from '../lib/includes';
import { SocketEvents } from '../../shared/events';
import { emitToUser, addUserToRoom, rooms } from '../socket/io';

const router = Router();
router.use(requireAuth);

const dmInclude = {
  participants: { include: { user: true } },
  messages: { include: messageInclude, orderBy: { createdAt: 'desc' as const }, take: 1 },
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const dms = await prisma.dMChannel.findMany({
      where: { participants: { some: { userId } } },
      include: dmInclude,
    });
    const mapped = dms
      .map((d) => toDM(d, userId))
      .sort((a, b) => {
        const at = a.lastMessage?.createdAt ?? '';
        const bt = b.lastMessage?.createdAt ?? '';
        return bt.localeCompare(at);
      });
    res.json({ items: mapped });
  }),
);

// Open (or create) a direct message with another user.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { userId: otherId } = z.object({ userId: z.string() }).parse(req.body);
    if (otherId === userId) throw new HttpError(400, 'Cannot DM yourself');
    const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
    if (!other) throw new HttpError(404, 'User not found');

    // Look for an existing 1:1 DM containing exactly these two users.
    const existing = await prisma.dMChannel.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
      include: dmInclude,
    });
    if (existing) return res.json({ dm: toDM(existing, userId) });

    const dm = await prisma.dMChannel.create({
      data: {
        isGroup: false,
        participants: { create: [{ userId }, { userId: otherId }] },
      },
      include: dmInclude,
    });
    for (const p of [userId, otherId]) addUserToRoom(p, rooms.dm(dm.id));
    emitToUser(otherId, SocketEvents.DM_CREATED, { dm: toDM(dm, otherId) });
    res.status(201).json({ dm: toDM(dm, userId) });
  }),
);

// Create a group DM.
router.post(
  '/group',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { userIds, name } = z.object({ userIds: z.array(z.string()).min(1).max(9), name: z.string().max(64).optional() }).parse(req.body);
    const ids = [...new Set([userId, ...userIds])];
    const dm = await prisma.dMChannel.create({
      data: {
        isGroup: true,
        name: name ?? null,
        ownerId: userId,
        participants: { create: ids.map((id) => ({ userId: id })) },
      },
      include: dmInclude,
    });
    for (const id of ids) {
      addUserToRoom(id, rooms.dm(dm.id));
      if (id !== userId) emitToUser(id, SocketEvents.DM_CREATED, { dm: toDM(dm, id) });
    }
    res.status(201).json({ dm: toDM(dm, userId) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const dm = await prisma.dMChannel.findFirst({
      where: { id: req.params.id, participants: { some: { userId } } },
      include: dmInclude,
    });
    if (!dm) throw new HttpError(404, 'Conversation not found');
    res.json({ dm: toDM(dm, userId) });
  }),
);

export default router;
