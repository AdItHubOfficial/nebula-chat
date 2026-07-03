import { prisma } from '../db';
import { combinePermissions, hasPermission, Permission } from '../../shared/permissions';

// Compute a member's effective permission bitfield within a server.
// The server owner implicitly has every permission.
export async function getMemberPermissions(serverId: string, userId: string): Promise<number | null> {
  const server = await prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  if (!server) return null;

  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: { roles: { include: { role: true } } },
  });
  if (!member) return null;

  if (server.ownerId === userId) return Permission.ADMINISTRATOR;

  const perms = member.roles.map((mr) => mr.role.permissions);
  return combinePermissions(perms);
}

export async function memberCan(serverId: string, userId: string, permission: number): Promise<boolean> {
  const perms = await getMemberPermissions(serverId, userId);
  if (perms === null) return false;
  return hasPermission(perms, permission);
}

export async function isServerOwner(serverId: string, userId: string): Promise<boolean> {
  const server = await prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
  return server?.ownerId === userId;
}

export async function writeAudit(serverId: string, actorId: string, action: string, targetId?: string, meta?: Record<string, unknown>) {
  return prisma.auditLog.create({
    data: { serverId, actorId, action, targetId, meta: JSON.stringify(meta ?? {}) },
  });
}
