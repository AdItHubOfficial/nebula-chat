import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { toPublicUser } from '../lib/serialize';
import { asyncHandler, HttpError } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { broadcastUserUpdate } from '../lib/broadcast';

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({
  displayName: z.string().min(1).max(32).optional(),
  bio: z.string().max(500).optional(),
  customStatus: z.string().max(128).optional(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  bannerColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  avatarUrl: z.string().max(512).nullable().optional(),
  presence: z.enum(['ONLINE', 'IDLE', 'DND', 'INVISIBLE']).optional(),
});

// Search users by username / display name.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = String(req.query.query ?? '').trim().toLowerCase();
    if (!query) return res.json({ items: [] });
    const users = await prisma.user.findMany({
      where: {
        OR: [{ username: { contains: query } }, { displayName: { contains: query } }],
      },
      take: 20,
    });
    res.json({ items: users.map(toPublicUser) });
  }),
);

// Update the current user's profile.
router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.userId! }, data });
    await broadcastUserUpdate(user.id);
    res.json({ user: toPublicUser(user) });
  }),
);

// Public profile lookup.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user: toPublicUser(user) });
  }),
);

export default router;
