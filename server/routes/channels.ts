import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { getMemberPermissions, writeAudit } from '../lib/guild';
import { hasPermission, Permission } from '../../shared/permissions';
import { toChannel, toCategory, toMessage } from '../lib/serialize';
import { messageInclude } from '../lib/includes';
import { SocketEvents } from '../../shared/events';
import { emitToServer } from '../socket/io';

const router = Router();
router.use(requireAuth);

async function channelWithPerm(channelId: string, userId: string, permission: number) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new HttpError(404, 'Channel not found');
  const perms = await getMemberPermissions(channel.serverId, userId);
  if (perms === null) throw new HttpError(403, 'Not a member');
  if (!hasPermission(perms, permission)) throw new HttpError(403, 'Missing permission');
  return channel;
}

const editSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  topic: z.string().max(300).optional(),
  isNsfw: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  categoryId: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

router.patch(
  '/channels/:channelId',
  asyncHandler(async (req, res) => {
    const existing = await channelWithPerm(req.params.channelId, req.userId!, Permission.MANAGE_CHANNELS);
    const data = editSchema.parse(req.body);
    if (data.name && existing.type !== 'VOICE') {
      data.name = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
    }
    const channel = await prisma.channel.update({ where: { id: existing.id }, data });
    emitToServer(channel.serverId, SocketEvents.CHANNEL_UPDATED, { channel: toChannel(channel) });
    res.json({ channel: toChannel(channel) });
  }),
);

router.delete(
  '/channels/:channelId',
  asyncHandler(async (req, res) => {
    const channel = await channelWithPerm(req.params.channelId, req.userId!, Permission.MANAGE_CHANNELS);
    await prisma.channel.delete({ where: { id: channel.id } });
    await writeAudit(channel.serverId, req.userId!, 'CHANNEL_DELETE', channel.id, { name: channel.name });
    emitToServer(channel.serverId, SocketEvents.CHANNEL_DELETED, { serverId: channel.serverId, channelId: channel.id });
    res.json({ ok: true });
  }),
);

router.get(
  '/channels/:channelId/pins',
  asyncHandler(async (req, res) => {
    const channel = await channelWithPerm(req.params.channelId, req.userId!, Permission.VIEW_CHANNELS);
    const pins = await prisma.message.findMany({
      where: { channelId: channel.id, pinned: true },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: pins.map((m) => toMessage(m, req.userId!)) });
  }),
);

// Category edit / delete.
router.patch(
  '/categories/:categoryId',
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { id: req.params.categoryId } });
    if (!category) throw new HttpError(404, 'Category not found');
    const perms = await getMemberPermissions(category.serverId, req.userId!);
    if (perms === null || !hasPermission(perms, Permission.MANAGE_CHANNELS)) throw new HttpError(403, 'Missing permission');
    const { name, position } = z.object({ name: z.string().min(1).max(64).optional(), position: z.number().int().optional() }).parse(req.body);
    const updated = await prisma.category.update({ where: { id: category.id }, data: { name, position } });
    emitToServer(category.serverId, SocketEvents.CHANNEL_UPDATED, { category: toCategory(updated) });
    res.json({ category: toCategory(updated) });
  }),
);

router.delete(
  '/categories/:categoryId',
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { id: req.params.categoryId } });
    if (!category) throw new HttpError(404, 'Category not found');
    const perms = await getMemberPermissions(category.serverId, req.userId!);
    if (perms === null || !hasPermission(perms, Permission.MANAGE_CHANNELS)) throw new HttpError(403, 'Missing permission');
    // Detach channels, then remove the category.
    await prisma.channel.updateMany({ where: { categoryId: category.id }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id: category.id } });
    emitToServer(category.serverId, SocketEvents.SERVER_UPDATED, { serverId: category.serverId });
    res.json({ ok: true });
  }),
);

export default router;
