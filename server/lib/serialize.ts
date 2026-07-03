import type {
  PublicUser,
  Member,
  Message,
  Channel,
  Category,
  Role,
  ServerSummary,
  ReactionGroup,
  Attachment,
  DMChannelDTO,
  FriendshipDTO,
  Invite,
  AuditEntry,
  PresenceState,
} from '../../shared/types';
import { isOnline } from './presence';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function effectivePresence(user: { id: string; presence: string }): PresenceState {
  if (user.presence === 'INVISIBLE') return 'OFFLINE';
  if (!isOnline(user.id)) return 'OFFLINE';
  return (user.presence as PresenceState) ?? 'OFFLINE';
}

export function toPublicUser(user: any): PublicUser {
  const presence = effectivePresence(user);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    bannerColor: user.bannerColor,
    accentColor: user.accentColor,
    bio: user.bio ?? '',
    customStatus: user.customStatus ?? '',
    presence,
    verified: user.verified ?? false,
    og: user.og ?? false,
    siteAdmin: user.siteAdmin ?? false,
    online: presence !== 'OFFLINE',
    createdAt: iso(user.createdAt),
  };
}

export function toRole(role: any): Role {
  return {
    id: role.id,
    serverId: role.serverId,
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions,
    hoist: role.hoist,
    mentionable: role.mentionable,
    isDefault: role.isDefault,
  };
}

export function toMember(member: any): Member {
  return {
    id: member.id,
    userId: member.userId,
    serverId: member.serverId,
    nickname: member.nickname ?? null,
    joinedAt: iso(member.joinedAt),
    timeoutUntil: member.timeoutUntil ? iso(member.timeoutUntil) : null,
    roles: (member.roles ?? []).map((r: any) => r.roleId ?? r.role?.id ?? r.id),
    user: toPublicUser(member.user),
  };
}

export function toCategory(c: any): Category {
  return { id: c.id, serverId: c.serverId, name: c.name, position: c.position };
}

export function toChannel(c: any): Channel {
  return {
    id: c.id,
    serverId: c.serverId,
    categoryId: c.categoryId ?? null,
    name: c.name,
    type: c.type,
    topic: c.topic ?? '',
    position: c.position,
    isPrivate: c.isPrivate,
    isNsfw: c.isNsfw,
  };
}

export function toServerSummary(s: any): ServerSummary {
  return {
    id: s.id,
    name: s.name,
    iconUrl: s.iconUrl ?? null,
    bannerColor: s.bannerColor,
    description: s.description ?? '',
    ownerId: s.ownerId,
  };
}

export function toAttachment(a: any): Attachment {
  return {
    id: a.id,
    url: a.url,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    width: a.width ?? null,
    height: a.height ?? null,
  };
}

export function groupReactions(reactions: any[], viewerId: string | null): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions ?? []) {
    let g = map.get(r.emoji);
    if (!g) {
      g = { emoji: r.emoji, count: 0, userIds: [], me: false };
      map.set(r.emoji, g);
    }
    g.count += 1;
    g.userIds.push(r.userId);
    if (viewerId && r.userId === viewerId) g.me = true;
  }
  return [...map.values()];
}

export function toMessage(m: any, viewerId: string | null): Message {
  return {
    id: m.id,
    channelId: m.channelId ?? null,
    dmChannelId: m.dmChannelId ?? null,
    authorId: m.authorId,
    author: toPublicUser(m.author),
    content: m.content,
    type: m.type,
    createdAt: iso(m.createdAt),
    editedAt: m.editedAt ? iso(m.editedAt) : null,
    pinned: m.pinned,
    replyToId: m.replyToId ?? null,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorId: m.replyTo.authorId,
          authorName: m.replyTo.author?.displayName ?? 'Unknown',
          content: m.replyTo.content,
        }
      : null,
    attachments: (m.attachments ?? []).map(toAttachment),
    reactions: groupReactions(m.reactions ?? [], viewerId),
  };
}

export function toDM(dm: any, viewerId: string): DMChannelDTO {
  return {
    id: dm.id,
    isGroup: dm.isGroup,
    name: dm.name ?? null,
    ownerId: dm.ownerId ?? null,
    participants: (dm.participants ?? [])
      .map((p: any) => toPublicUser(p.user))
      .filter((u: PublicUser) => u.id !== viewerId || dm.isGroup),
    lastMessage: dm.messages?.[0] ? toMessage(dm.messages[0], viewerId) : null,
  };
}

export function toFriendship(f: any, viewerId: string): FriendshipDTO {
  const isRequester = f.requesterId === viewerId;
  const other = isRequester ? f.addressee : f.requester;
  let direction: FriendshipDTO['direction'] = 'mutual';
  if (f.status === 'PENDING') direction = isRequester ? 'outgoing' : 'incoming';
  return {
    id: f.id,
    status: f.status,
    direction,
    user: toPublicUser(other),
    createdAt: iso(f.createdAt),
  };
}

export function toInvite(i: any): Invite {
  return {
    code: i.code,
    serverId: i.serverId,
    inviterId: i.inviterId,
    uses: i.uses,
    maxUses: i.maxUses,
    createdAt: iso(i.createdAt),
    expiresAt: i.expiresAt ? iso(i.expiresAt) : null,
    server: i.server ? toServerSummary(i.server) : undefined,
  };
}

export function toAudit(a: any): AuditEntry {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(a.meta ?? '{}');
  } catch {
    meta = {};
  }
  return {
    id: a.id,
    serverId: a.serverId,
    actorId: a.actorId,
    actor: toPublicUser(a.actor),
    action: a.action,
    targetId: a.targetId ?? null,
    meta,
    createdAt: iso(a.createdAt),
  };
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
