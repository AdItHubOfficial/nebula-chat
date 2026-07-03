import type { Server as IOServer, Socket } from 'socket.io';
import { z } from 'zod';
import { prisma } from '../db';
import { verifyToken } from '../lib/auth';
import { SocketEvents } from '../../shared/events';
import { Permission, hasPermission } from '../../shared/permissions';
import { getMemberPermissions } from '../lib/guild';
import { messageInclude } from '../lib/includes';
import { toMessage } from '../lib/serialize';
import { addConnection, removeConnection, onlineUserIds } from '../lib/presence';
import { broadcastUserUpdate } from '../lib/broadcast';
import { rooms, emitToServer, emitToDM, emitToUser } from './io';
import { registerVoiceHandlers, cleanupVoice, sendVoiceSnapshot } from './voice';

interface SocketUser {
  id: string;
  displayName: string;
}

type Ack = (response: { ok?: boolean; error?: string; message?: unknown }) => void;

const createSchema = z.object({
  channelId: z.string().optional(),
  dmChannelId: z.string().optional(),
  content: z.string().max(4000).default(''),
  replyToId: z.string().nullable().optional(),
  nonce: z.string().optional(),
  attachments: z
    .array(z.object({ url: z.string(), filename: z.string(), mimeType: z.string(), size: z.number() }))
    .max(10)
    .optional(),
});

// Resolve where a message is going and whether the user may post there.
async function resolveWriteTarget(user: SocketUser, channelId?: string, dmChannelId?: string) {
  if (channelId) {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new Error('Channel not found');
    const perms = await getMemberPermissions(channel.serverId, user.id);
    if (perms === null || !hasPermission(perms, Permission.SEND_MESSAGES)) throw new Error('You cannot send messages here');
    const member = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: channel.serverId, userId: user.id } } });
    if (member?.timeoutUntil && member.timeoutUntil > new Date()) throw new Error('You are timed out in this server');
    return { channel, serverId: channel.serverId };
  }
  if (dmChannelId) {
    const p = await prisma.dMParticipant.findUnique({ where: { dmChannelId_userId: { dmChannelId, userId: user.id } } });
    if (!p) throw new Error('Not part of this conversation');
    return { dmChannelId };
  }
  throw new Error('No target channel');
}

export function setupSocket(io: IOServer) {
  // Authenticate every socket from its handshake token.
  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string);
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error('Unauthorized'));
    (socket.data as { userId: string }).userId = payload.userId;
    next();
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } });
    if (!dbUser) return socket.disconnect(true);
    const user: SocketUser = { id: dbUser.id, displayName: dbUser.displayName };
    (socket.data as { user: SocketUser }).user = user;

    const cameOnline = addConnection(userId, socket.id);
    socket.join(rooms.user(userId));

    // Join every server + DM room this user belongs to.
    const [memberships, dmParts] = await Promise.all([
      prisma.serverMember.findMany({ where: { userId }, select: { serverId: true } }),
      prisma.dMParticipant.findMany({ where: { userId }, select: { dmChannelId: true } }),
    ]);
    memberships.forEach((m) => socket.join(rooms.server(m.serverId)));
    dmParts.forEach((d) => socket.join(rooms.dm(d.dmChannelId)));

    socket.emit(SocketEvents.READY, { userId, online: onlineUserIds() });
    await sendVoiceSnapshot(socket, [
      ...memberships.map((m) => rooms.server(m.serverId)),
      ...dmParts.map((d) => rooms.dm(d.dmChannelId)),
    ]);
    if (cameOnline) await broadcastUserUpdate(userId);

    // ---- channel subscription (for typing indicators) --------------------
    socket.on(SocketEvents.SUBSCRIBE_CHANNEL, (payload: { channelId?: string }) => {
      if (payload?.channelId) socket.join(rooms.channel(payload.channelId));
    });
    socket.on(SocketEvents.UNSUBSCRIBE_CHANNEL, (payload: { channelId?: string }) => {
      if (payload?.channelId) socket.leave(rooms.channel(payload.channelId));
    });

    // ---- create message --------------------------------------------------
    socket.on(SocketEvents.MESSAGE_CREATE, async (raw: unknown, ack?: Ack) => {
      try {
        const data = createSchema.parse(raw);
        if (!data.content.trim() && !(data.attachments && data.attachments.length)) {
          throw new Error('Message is empty');
        }
        const target = await resolveWriteTarget(user, data.channelId, data.dmChannelId);

        const message = await prisma.message.create({
          data: {
            channelId: data.channelId ?? null,
            dmChannelId: data.dmChannelId ?? null,
            authorId: userId,
            content: data.content.trim(),
            replyToId: data.replyToId ?? null,
            attachments: data.attachments?.length ? { create: data.attachments } : undefined,
          },
          include: messageInclude,
        });

        // Author has now "read" up to their own message.
        await upsertRead(userId, data.channelId, data.dmChannelId);

        const dto = toMessage(message, null);
        if ('serverId' in target && target.serverId) {
          emitToServer(target.serverId, SocketEvents.MESSAGE_NEW, { message: dto, nonce: data.nonce });
        } else if (data.dmChannelId) {
          emitToDM(data.dmChannelId, SocketEvents.MESSAGE_NEW, { message: dto, nonce: data.nonce });
        }
        ack?.({ ok: true, message: dto });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    // ---- edit ------------------------------------------------------------
    socket.on(SocketEvents.MESSAGE_UPDATE, async (raw: unknown, ack?: Ack) => {
      try {
        const { messageId, content } = z.object({ messageId: z.string(), content: z.string().max(4000) }).parse(raw);
        const existing = await prisma.message.findUnique({ where: { id: messageId } });
        if (!existing) throw new Error('Message not found');
        if (existing.authorId !== userId) throw new Error('You can only edit your own messages');
        const updated = await prisma.message.update({ where: { id: messageId }, data: { content: content.trim(), editedAt: new Date() }, include: messageInclude });
        const dto = toMessage(updated, null);
        broadcastToTarget(existing, SocketEvents.MESSAGE_UPDATED, { message: dto });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    // ---- delete ----------------------------------------------------------
    socket.on(SocketEvents.MESSAGE_DELETE, async (raw: unknown, ack?: Ack) => {
      try {
        const { messageId } = z.object({ messageId: z.string() }).parse(raw);
        const existing = await prisma.message.findUnique({ where: { id: messageId }, include: { channel: true } });
        if (!existing) throw new Error('Message not found');
        let allowed = existing.authorId === userId;
        if (!allowed && existing.channel) {
          const perms = await getMemberPermissions(existing.channel.serverId, userId);
          allowed = perms !== null && hasPermission(perms, Permission.MANAGE_MESSAGES);
        }
        if (!allowed) throw new Error('Cannot delete this message');
        await prisma.message.delete({ where: { id: messageId } });
        broadcastToTarget(existing, SocketEvents.MESSAGE_DELETED, { messageId, channelId: existing.channelId, dmChannelId: existing.dmChannelId });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    // ---- pin -------------------------------------------------------------
    socket.on(SocketEvents.MESSAGE_PIN, async (raw: unknown, ack?: Ack) => {
      try {
        const { messageId, pinned } = z.object({ messageId: z.string(), pinned: z.boolean() }).parse(raw);
        const existing = await prisma.message.findUnique({ where: { id: messageId }, include: { channel: true } });
        if (!existing?.channel) throw new Error('Message not found');
        const perms = await getMemberPermissions(existing.channel.serverId, userId);
        if (perms === null || !hasPermission(perms, Permission.MANAGE_MESSAGES)) throw new Error('Missing permission');
        await prisma.message.update({ where: { id: messageId }, data: { pinned } });
        broadcastToTarget(existing, SocketEvents.MESSAGE_PINNED, { messageId, pinned, channelId: existing.channelId });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    // ---- reactions -------------------------------------------------------
    socket.on(SocketEvents.REACTION_ADD, async (raw: unknown) => {
      try {
        const { messageId, emoji } = z.object({ messageId: z.string(), emoji: z.string().max(64) }).parse(raw);
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg) return;
        await prisma.reaction.upsert({
          where: { messageId_userId_emoji: { messageId, userId, emoji } },
          create: { messageId, userId, emoji },
          update: {},
        });
        broadcastToTarget(msg, SocketEvents.REACTION_UPDATED, { messageId, emoji, userId, add: true });
      } catch {
        /* ignore malformed */
      }
    });

    socket.on(SocketEvents.REACTION_REMOVE, async (raw: unknown) => {
      try {
        const { messageId, emoji } = z.object({ messageId: z.string(), emoji: z.string().max(64) }).parse(raw);
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg) return;
        await prisma.reaction.deleteMany({ where: { messageId, userId, emoji } });
        broadcastToTarget(msg, SocketEvents.REACTION_UPDATED, { messageId, emoji, userId, add: false });
      } catch {
        /* ignore */
      }
    });

    // ---- typing ----------------------------------------------------------
    socket.on(SocketEvents.TYPING_START, (raw: { channelId?: string; dmChannelId?: string }) => {
      const payload = { userId, displayName: user.displayName, channelId: raw?.channelId ?? raw?.dmChannelId };
      if (raw?.channelId) socket.to(rooms.channel(raw.channelId)).emit(SocketEvents.TYPING_UPDATE, payload);
      else if (raw?.dmChannelId) socket.to(rooms.dm(raw.dmChannelId)).emit(SocketEvents.TYPING_UPDATE, payload);
    });

    // ---- read receipts ---------------------------------------------------
    socket.on(SocketEvents.READ_ACK, async (raw: { channelId?: string; dmChannelId?: string }) => {
      await upsertRead(userId, raw?.channelId, raw?.dmChannelId);
      emitToUser(userId, SocketEvents.READ_UPDATED, { channelId: raw?.channelId, dmChannelId: raw?.dmChannelId });
      if (raw?.dmChannelId) {
        socket.to(rooms.dm(raw.dmChannelId)).emit(SocketEvents.READ_UPDATED, { dmChannelId: raw.dmChannelId, userId, at: new Date().toISOString() });
      }
    });

    // ---- presence quick-set ---------------------------------------------
    socket.on(SocketEvents.PRESENCE_UPDATE, async (raw: { presence?: string }) => {
      const presence = raw?.presence;
      if (presence && ['ONLINE', 'IDLE', 'DND', 'INVISIBLE'].includes(presence)) {
        await prisma.user.update({ where: { id: userId }, data: { presence } });
        await broadcastUserUpdate(userId);
      }
    });

    // ---- voice -----------------------------------------------------------
    registerVoiceHandlers(io, socket, user);

    // ---- disconnect ------------------------------------------------------
    socket.on('disconnect', async () => {
      cleanupVoice(io, socket, user);
      const nowOffline = removeConnection(userId, socket.id);
      if (nowOffline) await broadcastUserUpdate(userId);
    });
  });
}

async function upsertRead(userId: string, channelId?: string, dmChannelId?: string) {
  if (channelId) {
    await prisma.readState.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { userId, channelId, mentionCount: 0 },
      update: { lastReadAt: new Date(), mentionCount: 0 },
    });
  } else if (dmChannelId) {
    await prisma.readState.upsert({
      where: { userId_dmChannelId: { userId, dmChannelId } },
      create: { userId, dmChannelId, mentionCount: 0 },
      update: { lastReadAt: new Date(), mentionCount: 0 },
    });
  }
}

// Broadcast an event to the room a message belongs to (server or DM).
function broadcastToTarget(msg: { channelId: string | null; dmChannelId: string | null }, event: string, payload: unknown) {
  if (msg.dmChannelId) {
    emitToDM(msg.dmChannelId, event, payload);
  } else if (msg.channelId) {
    // Look up the server lazily; channel messages fan out to the server room.
    prisma.channel
      .findUnique({ where: { id: msg.channelId }, select: { serverId: true } })
      .then((c) => {
        if (c) emitToServer(c.serverId, event, payload);
      })
      .catch(() => {});
  }
}
