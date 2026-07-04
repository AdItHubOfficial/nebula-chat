import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { toPublicUser } from '../lib/serialize';
import { broadcastUserUpdate } from '../lib/broadcast';

const router = Router();
router.use(requireAuth);

// Gate everything below to the founder / site administrator.
router.use(
  asyncHandler(async (req, _res, next) => {
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { siteAdmin: true } });
    if (!me?.siteAdmin) throw new HttpError(403, 'Founder access only');
    next();
  }),
);

const badgeSchema = z.object({
  verified: z.boolean().optional(),
  og: z.boolean().optional(),
  adminBadge: z.boolean().optional(),
  ownerBadge: z.boolean().optional(),
  coOwnerBadge: z.boolean().optional(),
  founderBadge: z.boolean().optional(),
});

// Grant or remove account badges for any user.
router.patch(
  '/users/:id/badges',
  asyncHandler(async (req, res) => {
    const data = badgeSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'User not found');
    const user = await prisma.user.update({ where: { id: target.id }, data });
    await broadcastUserUpdate(user.id);
    res.json({ user: toPublicUser(user) });
  }),
);

export default router;
