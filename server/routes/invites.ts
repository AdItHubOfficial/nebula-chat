import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/errors';
import { getMemberPermissions, isServerOwner } from '../lib/guild';
import { hasPermission, Permission } from '../../shared/permissions';
import { toInvite, toServerSummary, toMember } from '../lib/serialize';
import { memberInclude } from '../lib/includes';
import { SocketEvents } from '../../shared/events';
import { emitToServer, addUserToRoom, rooms } from '../socket/io';

const router = Router();
router.use(requireAuth);

function generateCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || randomBytes(4).toString('hex');
}

// Create an invite.
router.post(
  '/servers/:serverId/invites',
  asyncHandler(async (req, res) => {
    const serverId = req.params.serverId;
    const perms = await getMemberPermissions(serverId, req.userId!);
    if (perms === null || !hasPermission(perms, Permission.CREATE_INVITE)) throw new HttpError(403, 'Cannot create invites');
    const { maxUses, expiresInHours } = z
      .object({ maxUses: z.number().int().min(0).max(1000).optional(), expiresInHours: z.number().min(0).max(720).optional() })
      .parse(req.body ?? {});

    let code = generateCode();
    // Ensure uniqueness.
    while (await prisma.invite.findUnique({ where: { code } })) code = generateCode();

    const invite = await prisma.invite.create({
      data: {
        code,
        serverId,
        inviterId: req.userId!,
        maxUses: maxUses ?? 0,
        expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 3600_000) : null,
      },
    });
    res.status(201).json({ invite: toInvite(invite) });
  }),
);

router.get(
  '/servers/:serverId/invites',
  asyncHandler(async (req, res) => {
    const serverId = req.params.serverId;
    const perms = await getMemberPermissions(serverId, req.userId!);
    if (perms === null) throw new HttpError(403, 'Not a member');
    const invites = await prisma.invite.findMany({ where: { serverId }, orderBy: { createdAt: 'desc' } });
    res.json({ items: invites.map(toInvite) });
  }),
);

// Preview an invite before joining.
router.get(
  '/invites/:code',
  asyncHandler(async (req, res) => {
    const invite = await prisma.invite.findUnique({
      where: { code: req.params.code },
      include: { server: { include: { _count: { select: { members: true } } } }, inviter: true },
    });
    if (!invite) throw new HttpError(404, 'Invite is invalid or expired');
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new HttpError(410, 'Invite has expired');
    res.json({
      invite: {
        code: invite.code,
        server: toServerSummary(invite.server),
        memberCount: invite.server._count.members,
        inviter: { id: invite.inviter.id, displayName: invite.inviter.displayName },
      },
    });
  }),
);

// Accept an invite (join the server).
router.post(
  '/invites/:code/join',
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const invite = await prisma.invite.findUnique({ where: { code: req.params.code } });
    if (!invite) throw new HttpError(404, 'Invite is invalid');
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new HttpError(410, 'Invite has expired');
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) throw new HttpError(410, 'Invite has been used up');

    const banned = await prisma.ban.findUnique({ where: { serverId_userId: { serverId: invite.serverId, userId } } });
    if (banned) throw new HttpError(403, 'You are banned from this server');

    const existing = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: invite.serverId, userId } } });
    if (existing) {
      const server = await prisma.server.findUnique({ where: { id: invite.serverId } });
      return res.json({ server: server ? toServerSummary(server) : null, already: true });
    }

    const everyone = await prisma.role.findFirst({ where: { serverId: invite.serverId, isDefault: true } });
    const member = await prisma.serverMember.create({ data: { serverId: invite.serverId, userId } });
    if (everyone) await prisma.memberRole.create({ data: { memberId: member.id, roleId: everyone.id } });
    await prisma.invite.update({ where: { code: invite.code }, data: { uses: { increment: 1 } } });

    const fullMember = await prisma.serverMember.findUnique({ where: { id: member.id }, include: memberInclude });
    addUserToRoom(userId, rooms.server(invite.serverId));
    emitToServer(invite.serverId, SocketEvents.MEMBER_JOINED, { member: toMember(fullMember) });

    const server = await prisma.server.findUnique({ where: { id: invite.serverId } });
    res.status(201).json({ server: server ? toServerSummary(server) : null });
  }),
);

router.delete(
  '/invites/:code',
  asyncHandler(async (req, res) => {
    const invite = await prisma.invite.findUnique({ where: { code: req.params.code } });
    if (!invite) throw new HttpError(404, 'Invite not found');
    const perms = await getMemberPermissions(invite.serverId, req.userId!);
    const owner = await isServerOwner(invite.serverId, req.userId!);
    if (invite.inviterId !== req.userId && !owner && !(perms && hasPermission(perms, Permission.MANAGE_SERVER))) {
      throw new HttpError(403, 'Cannot delete this invite');
    }
    await prisma.invite.delete({ where: { code: invite.code } });
    res.json({ ok: true });
  }),
);

export default router;
