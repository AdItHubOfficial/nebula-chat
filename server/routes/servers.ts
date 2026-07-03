import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { getMemberPermissions, writeAudit, isServerOwner } from '../lib/guild';
import { hasPermission, Permission, DEFAULT_PERMISSIONS, ALL_PERMISSIONS } from '../../shared/permissions';
import { serverInclude, memberInclude } from '../lib/includes';
import {
  toServerSummary,
  toChannel,
  toCategory,
  toRole,
  toMember,
  toAudit,
} from '../lib/serialize';
import { SocketEvents } from '../../shared/events';
import { emitToServer, emitToUser, addUserToRoom, removeUserFromRoom, rooms } from '../socket/io';

const router = Router();
router.use(requireAuth);

async function requirePerm(serverId: string, userId: string, permission: number) {
  const perms = await getMemberPermissions(serverId, userId);
  if (perms === null) throw new HttpError(403, 'You are not a member of this server');
  if (!hasPermission(perms, permission)) throw new HttpError(403, 'Missing permission');
  return perms;
}

async function loadDetail(serverId: string) {
  const server = await prisma.server.findUnique({ where: { id: serverId }, include: serverInclude });
  if (!server) throw new HttpError(404, 'Server not found');
  return {
    ...toServerSummary(server),
    categories: server.categories.map(toCategory),
    channels: server.channels.map(toChannel),
    roles: server.roles.map(toRole),
    memberCount: server._count.members,
  };
}

// List servers the user belongs to.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await prisma.serverMember.findMany({
      where: { userId: req.userId! },
      include: { server: true },
      orderBy: { joinedAt: 'asc' },
    });
    res.json({ items: memberships.map((m) => toServerSummary(m.server)) });
  }),
);

const createSchema = z.object({
  name: z.string().min(2).max(64),
  bannerColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  iconUrl: z.string().max(512).optional(),
});

// Create a server with sensible default channels + roles.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, bannerColor, iconUrl } = createSchema.parse(req.body);
    const userId = req.userId!;

    const server = await prisma.server.create({
      data: {
        name,
        bannerColor: bannerColor ?? '#6366f1',
        iconUrl: iconUrl ?? null,
        ownerId: userId,
      },
    });

    const everyone = await prisma.role.create({
      data: { serverId: server.id, name: '@everyone', permissions: DEFAULT_PERMISSIONS, isDefault: true },
    });
    const ownerRole = await prisma.role.create({
      data: { serverId: server.id, name: 'Owner', color: bannerColor ?? '#6366f1', position: 1, hoist: true, permissions: ALL_PERMISSIONS },
    });
    const member = await prisma.serverMember.create({ data: { serverId: server.id, userId } });
    await prisma.memberRole.createMany({ data: [
      { memberId: member.id, roleId: everyone.id },
      { memberId: member.id, roleId: ownerRole.id },
    ] });

    const textCat = await prisma.category.create({ data: { serverId: server.id, name: 'Text Channels', position: 0 } });
    const voiceCat = await prisma.category.create({ data: { serverId: server.id, name: 'Voice Channels', position: 1 } });
    await prisma.channel.create({ data: { serverId: server.id, categoryId: textCat.id, name: 'general', type: 'TEXT', position: 0 } });
    await prisma.channel.create({ data: { serverId: server.id, categoryId: voiceCat.id, name: 'General', type: 'VOICE', position: 0 } });

    addUserToRoom(userId, rooms.server(server.id));
    res.status(201).json({ server: await loadDetail(server.id) });
  }),
);

// Full server detail (members-only).
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.VIEW_CHANNELS);
    res.json({ server: await loadDetail(req.params.id) });
  }),
);

const updateSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(300).optional(),
  bannerColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  iconUrl: z.string().max(512).nullable().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.MANAGE_SERVER);
    const data = updateSchema.parse(req.body);
    await prisma.server.update({ where: { id: req.params.id }, data });
    const detail = await loadDetail(req.params.id);
    emitToServer(req.params.id, SocketEvents.SERVER_UPDATED, { server: detail });
    res.json({ server: detail });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!(await isServerOwner(req.params.id, req.userId!))) throw new HttpError(403, 'Only the owner can delete this server');
    emitToServer(req.params.id, SocketEvents.SERVER_DELETED, { serverId: req.params.id });
    await prisma.server.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

// Leave a server (owner cannot leave, must delete or transfer).
router.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    if (await isServerOwner(req.params.id, userId)) throw new HttpError(400, 'Owners must delete the server instead of leaving');
    const member = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: req.params.id, userId } } });
    if (!member) throw new HttpError(404, 'Not a member');
    await prisma.serverMember.delete({ where: { id: member.id } });
    emitToServer(req.params.id, SocketEvents.MEMBER_LEFT, { serverId: req.params.id, userId });
    removeUserFromRoom(userId, rooms.server(req.params.id));
    res.json({ ok: true });
  }),
);

// Member list.
router.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.VIEW_CHANNELS);
    const members = await prisma.serverMember.findMany({
      where: { serverId: req.params.id },
      include: memberInclude,
      orderBy: { joinedAt: 'asc' },
    });
    res.json({ items: members.map(toMember) });
  }),
);

// Update a member (nickname by self/manage, roles requires MANAGE_ROLES).
const memberUpdateSchema = z.object({
  nickname: z.string().max(32).nullable().optional(),
  roleIds: z.array(z.string()).optional(),
});
router.patch(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { id: serverId, userId: targetId } = req.params;
    const actorId = req.userId!;
    const { nickname, roleIds } = memberUpdateSchema.parse(req.body);

    const perms = await getMemberPermissions(serverId, actorId);
    if (perms === null) throw new HttpError(403, 'Not a member');

    const member = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: targetId } }, include: memberInclude });
    if (!member) throw new HttpError(404, 'Member not found');

    if (nickname !== undefined) {
      const canManage = hasPermission(perms, Permission.MANAGE_ROLES) || actorId === targetId;
      if (!canManage) throw new HttpError(403, 'Cannot change this nickname');
      await prisma.serverMember.update({ where: { id: member.id }, data: { nickname } });
    }

    if (roleIds !== undefined) {
      if (!hasPermission(perms, Permission.MANAGE_ROLES)) throw new HttpError(403, 'Missing Manage Roles');
      const valid = await prisma.role.findMany({ where: { serverId, id: { in: roleIds } }, select: { id: true, isDefault: true } });
      const everyone = await prisma.role.findFirst({ where: { serverId, isDefault: true }, select: { id: true } });
      const finalIds = new Set(valid.map((r) => r.id));
      if (everyone) finalIds.add(everyone.id); // @everyone always applies
      await prisma.memberRole.deleteMany({ where: { memberId: member.id } });
      await prisma.memberRole.createMany({ data: [...finalIds].map((roleId) => ({ memberId: member.id, roleId })) });
      await writeAudit(serverId, actorId, 'MEMBER_ROLES_UPDATE', targetId, { roleIds: [...finalIds] });
    }

    const updated = await prisma.serverMember.findUnique({ where: { id: member.id }, include: memberInclude });
    const dto = toMember(updated);
    emitToServer(serverId, SocketEvents.MEMBER_UPDATED, { member: dto });
    res.json({ member: dto });
  }),
);

// Kick a member.
router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const { id: serverId, userId: targetId } = req.params;
    await requirePerm(serverId, req.userId!, Permission.KICK_MEMBERS);
    if (await isServerOwner(serverId, targetId)) throw new HttpError(400, 'Cannot kick the owner');
    const member = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: targetId } } });
    if (!member) throw new HttpError(404, 'Member not found');
    await prisma.serverMember.delete({ where: { id: member.id } });
    await writeAudit(serverId, req.userId!, 'MEMBER_KICK', targetId);
    emitToServer(serverId, SocketEvents.MEMBER_LEFT, { serverId, userId: targetId });
    emitToUser(targetId, SocketEvents.SERVER_DELETED, { serverId });
    removeUserFromRoom(targetId, rooms.server(serverId));
    res.json({ ok: true });
  }),
);

// Timeout a member.
router.post(
  '/:id/members/:userId/timeout',
  asyncHandler(async (req, res) => {
    const { id: serverId, userId: targetId } = req.params;
    await requirePerm(serverId, req.userId!, Permission.TIMEOUT_MEMBERS);
    const minutes = z.number().min(0).max(40320).parse(req.body?.minutes ?? 10);
    const until = minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
    const member = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: targetId } } });
    if (!member) throw new HttpError(404, 'Member not found');
    await prisma.serverMember.update({ where: { id: member.id }, data: { timeoutUntil: until } });
    await writeAudit(serverId, req.userId!, 'MEMBER_TIMEOUT', targetId, { minutes });
    const updated = await prisma.serverMember.findUnique({ where: { id: member.id }, include: memberInclude });
    emitToServer(serverId, SocketEvents.MEMBER_UPDATED, { member: toMember(updated) });
    res.json({ ok: true });
  }),
);

// Ban / list bans / unban.
router.get(
  '/:id/bans',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.BAN_MEMBERS);
    const bans = await prisma.ban.findMany({ where: { serverId: req.params.id }, include: { user: true } });
    res.json({ items: bans.map((b) => ({ id: b.id, reason: b.reason, createdAt: b.createdAt.toISOString(), user: { id: b.user.id, username: b.user.username, displayName: b.user.displayName, avatarUrl: b.user.avatarUrl } })) });
  }),
);
router.post(
  '/:id/bans',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.BAN_MEMBERS);
    const { userId: targetId, reason } = z.object({ userId: z.string(), reason: z.string().max(300).optional() }).parse(req.body);
    if (await isServerOwner(serverId, targetId)) throw new HttpError(400, 'Cannot ban the owner');
    await prisma.ban.upsert({
      where: { serverId_userId: { serverId, userId: targetId } },
      create: { serverId, userId: targetId, reason: reason ?? '' },
      update: { reason: reason ?? '' },
    });
    await prisma.serverMember.deleteMany({ where: { serverId, userId: targetId } });
    await writeAudit(serverId, req.userId!, 'MEMBER_BAN', targetId, { reason });
    emitToServer(serverId, SocketEvents.MEMBER_LEFT, { serverId, userId: targetId });
    emitToUser(targetId, SocketEvents.SERVER_DELETED, { serverId });
    removeUserFromRoom(targetId, rooms.server(serverId));
    res.json({ ok: true });
  }),
);
router.delete(
  '/:id/bans/:userId',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.BAN_MEMBERS);
    await prisma.ban.deleteMany({ where: { serverId: req.params.id, userId: req.params.userId } });
    res.json({ ok: true });
  }),
);

// Roles CRUD.
const roleSchema = z.object({
  name: z.string().min(1).max(32),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  permissions: z.number().int().optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
});
router.post(
  '/:id/roles',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.MANAGE_ROLES);
    const data = roleSchema.parse(req.body);
    const count = await prisma.role.count({ where: { serverId } });
    const role = await prisma.role.create({ data: { serverId, position: count, permissions: DEFAULT_PERMISSIONS, ...data } });
    await writeAudit(serverId, req.userId!, 'ROLE_CREATE', role.id, { name: role.name });
    emitToServer(serverId, SocketEvents.SERVER_UPDATED, { server: await loadDetail(serverId) });
    res.status(201).json({ role: toRole(role) });
  }),
);
router.patch(
  '/:id/roles/:roleId',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.MANAGE_ROLES);
    const data = roleSchema.partial().parse(req.body);
    const role = await prisma.role.update({ where: { id: req.params.roleId }, data });
    emitToServer(serverId, SocketEvents.SERVER_UPDATED, { server: await loadDetail(serverId) });
    res.json({ role: toRole(role) });
  }),
);
router.delete(
  '/:id/roles/:roleId',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.MANAGE_ROLES);
    const role = await prisma.role.findUnique({ where: { id: req.params.roleId } });
    if (!role) throw new HttpError(404, 'Role not found');
    if (role.isDefault) throw new HttpError(400, 'Cannot delete the @everyone role');
    await prisma.role.delete({ where: { id: role.id } });
    emitToServer(serverId, SocketEvents.SERVER_UPDATED, { server: await loadDetail(serverId) });
    res.json({ ok: true });
  }),
);

// Audit log.
router.get(
  '/:id/audit',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.VIEW_AUDIT_LOG);
    const entries = await prisma.auditLog.findMany({
      where: { serverId: req.params.id },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items: entries.map(toAudit) });
  }),
);

// Custom emojis.
router.get(
  '/:id/emojis',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.VIEW_CHANNELS);
    const emojis = await prisma.emoji.findMany({ where: { serverId: req.params.id } });
    res.json({ items: emojis.map((e) => ({ id: e.id, serverId: e.serverId, name: e.name, url: e.url })) });
  }),
);
router.post(
  '/:id/emojis',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.MANAGE_EMOJIS);
    const { name, url } = z.object({ name: z.string().min(1).max(32).regex(/^[a-z0-9_]+$/i), url: z.string().max(512) }).parse(req.body);
    const emoji = await prisma.emoji.create({ data: { serverId, name, url } });
    res.status(201).json({ emoji: { id: emoji.id, serverId, name, url } });
  }),
);
router.delete(
  '/:id/emojis/:emojiId',
  asyncHandler(async (req, res) => {
    await requirePerm(req.params.id, req.userId!, Permission.MANAGE_EMOJIS);
    await prisma.emoji.deleteMany({ where: { id: req.params.emojiId, serverId: req.params.id } });
    res.json({ ok: true });
  }),
);

// Create a channel.
const channelSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['TEXT', 'VOICE', 'ANNOUNCEMENT']).default('TEXT'),
  categoryId: z.string().nullable().optional(),
  topic: z.string().max(300).optional(),
  isPrivate: z.boolean().optional(),
  isNsfw: z.boolean().optional(),
});
router.post(
  '/:id/channels',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.MANAGE_CHANNELS);
    const data = channelSchema.parse(req.body);
    const cleanName = data.type === 'VOICE' ? data.name : data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
    const count = await prisma.channel.count({ where: { serverId, categoryId: data.categoryId ?? null } });
    const channel = await prisma.channel.create({
      data: {
        serverId,
        name: cleanName || 'channel',
        type: data.type,
        categoryId: data.categoryId ?? null,
        topic: data.topic ?? '',
        isPrivate: data.isPrivate ?? false,
        isNsfw: data.isNsfw ?? false,
        position: count,
      },
    });
    await writeAudit(serverId, req.userId!, 'CHANNEL_CREATE', channel.id, { name: channel.name });
    emitToServer(serverId, SocketEvents.CHANNEL_CREATED, { channel: toChannel(channel) });
    res.status(201).json({ channel: toChannel(channel) });
  }),
);

// Create a category.
router.post(
  '/:id/categories',
  asyncHandler(async (req, res) => {
    const serverId = req.params.id;
    await requirePerm(serverId, req.userId!, Permission.MANAGE_CHANNELS);
    const { name } = z.object({ name: z.string().min(1).max(64) }).parse(req.body);
    const count = await prisma.category.count({ where: { serverId } });
    const category = await prisma.category.create({ data: { serverId, name, position: count } });
    emitToServer(serverId, SocketEvents.SERVER_UPDATED, { server: await loadDetail(serverId) });
    res.status(201).json({ category: toCategory(category) });
  }),
);

export default router;
