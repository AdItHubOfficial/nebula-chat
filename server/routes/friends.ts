import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { toFriendship } from '../lib/serialize';
import { SocketEvents } from '../../shared/events';
import { emitToUser } from '../socket/io';

const router = Router();
router.use(requireAuth);

async function loadFriendship(id: string) {
  return prisma.friendship.findUnique({ where: { id }, include: { requester: true, addressee: true } });
}

function notifyBoth(f: { requesterId: string; addresseeId: string }) {
  emitToUser(f.requesterId, SocketEvents.FRIEND_UPDATE, {});
  emitToUser(f.addresseeId, SocketEvents.FRIEND_UPDATE, {});
}

// List all relationships for the current user.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: true, addressee: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: rows.map((f) => toFriendship(f, userId)) });
  }),
);

// Send a friend request by username.
router.post(
  '/request',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { username } = z.object({ username: z.string().min(1) }).parse(req.body);
    const target = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } });
    if (!target) throw new HttpError(404, 'No user with that username');
    if (target.id === userId) throw new HttpError(400, 'You cannot add yourself');

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'BLOCKED') throw new HttpError(400, 'Unable to send request');
      if (existing.status === 'ACCEPTED') throw new HttpError(409, 'You are already friends');
      throw new HttpError(409, 'A request is already pending');
    }

    const f = await prisma.friendship.create({ data: { requesterId: userId, addresseeId: target.id, status: 'PENDING' } });
    notifyBoth(f);
    res.status(201).json({ ok: true });
  }),
);

router.post(
  '/:id/accept',
  asyncHandler(async (req, res) => {
    const f = await loadFriendship(req.params.id);
    if (!f || f.addresseeId !== req.userId) throw new HttpError(404, 'Request not found');
    if (f.status !== 'PENDING') throw new HttpError(400, 'Request is not pending');
    const updated = await prisma.friendship.update({ where: { id: f.id }, data: { status: 'ACCEPTED' } });
    notifyBoth(updated);
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/decline',
  asyncHandler(async (req, res) => {
    const f = await loadFriendship(req.params.id);
    if (!f || (f.addresseeId !== req.userId && f.requesterId !== req.userId)) throw new HttpError(404, 'Request not found');
    await prisma.friendship.delete({ where: { id: f.id } });
    notifyBoth(f);
    res.json({ ok: true });
  }),
);

// Remove an existing friend.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const f = await loadFriendship(req.params.id);
    if (!f || (f.addresseeId !== req.userId && f.requesterId !== req.userId)) throw new HttpError(404, 'Not found');
    await prisma.friendship.delete({ where: { id: f.id } });
    notifyBoth(f);
    res.json({ ok: true });
  }),
);

// Block a user (removes any existing relationship first).
router.post(
  '/block',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { userId: targetId } = z.object({ userId: z.string() }).parse(req.body);
    if (targetId === userId) throw new HttpError(400, 'You cannot block yourself');
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: userId },
        ],
      },
    });
    const f = await prisma.friendship.create({ data: { requesterId: userId, addresseeId: targetId, status: 'BLOCKED' } });
    notifyBoth(f);
    res.json({ ok: true });
  }),
);

router.delete(
  '/block/:userId',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    await prisma.friendship.deleteMany({ where: { requesterId: userId, addresseeId: req.params.userId, status: 'BLOCKED' } });
    emitToUser(userId, SocketEvents.FRIEND_UPDATE, {});
    res.json({ ok: true });
  }),
);

export default router;
