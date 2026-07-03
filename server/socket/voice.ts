import type { Server as IOServer, Socket } from 'socket.io';
import { prisma } from '../db';
import { SocketEvents } from '../../shared/events';
import { Permission, hasPermission } from '../../shared/permissions';
import { getMemberPermissions } from '../lib/guild';
import { rooms } from './io';

interface VoiceUser {
  id: string;
  displayName: string;
}

interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  video: boolean;
}

// roomKey (channelId or dmId) -> (socketId -> participant)
const voiceRooms = new Map<string, Map<string, Participant>>();
// roomKey -> the Socket.IO room to fan voice state out to (server or dm room)
const roomBroadcast = new Map<string, string>();
// socketId -> set of roomKeys it is connected to (usually 0 or 1)
const socketChannels = new Map<string, Set<string>>();

function participantsOf(key: string): Participant[] {
  return [...(voiceRooms.get(key)?.values() ?? [])];
}

function serialize(key: string) {
  return participantsOf(key).map((p) => ({
    userId: p.userId,
    socketId: p.socketId,
    displayName: p.displayName,
    muted: p.muted,
    deafened: p.deafened,
    speaking: p.speaking,
    video: p.video,
  }));
}

function emitVoiceState(io: IOServer, key: string) {
  const participants = serialize(key);
  io.to(rooms.voice(key)).emit(SocketEvents.VOICE_STATE, { channelId: key, participants });
  const room = roomBroadcast.get(key);
  if (room) io.to(room).emit(SocketEvents.VOICE_STATE, { channelId: key, participants });
}

// Send current voice occupancy to a freshly connected socket for any room it can see.
export async function sendVoiceSnapshot(socket: Socket, roomStrings: string[]) {
  const set = new Set(roomStrings);
  for (const key of voiceRooms.keys()) {
    const room = roomBroadcast.get(key);
    if (room && set.has(room) && (voiceRooms.get(key)?.size ?? 0) > 0) {
      socket.emit(SocketEvents.VOICE_STATE, { channelId: key, participants: serialize(key) });
    }
  }
}

export function registerVoiceHandlers(io: IOServer, socket: Socket, user: VoiceUser) {
  socket.on(SocketEvents.VOICE_JOIN, async (raw: { channelId?: string; dmId?: string }, ack?: (r: { ok?: boolean; error?: string }) => void) => {
    try {
      let key: string;
      let broadcastRoom: string;

      if (raw?.channelId) {
        const channel = await prisma.channel.findUnique({ where: { id: raw.channelId } });
        if (!channel || channel.type !== 'VOICE') throw new Error('Not a voice channel');
        const perms = await getMemberPermissions(channel.serverId, user.id);
        if (perms === null || !hasPermission(perms, Permission.CONNECT_VOICE)) throw new Error('Cannot connect to voice');
        key = channel.id;
        broadcastRoom = rooms.server(channel.serverId);
      } else if (raw?.dmId) {
        const part = await prisma.dMParticipant.findUnique({ where: { dmChannelId_userId: { dmChannelId: raw.dmId, userId: user.id } } });
        if (!part) throw new Error('Not part of this conversation');
        key = raw.dmId;
        broadcastRoom = rooms.dm(raw.dmId);
      } else {
        throw new Error('No target');
      }

      roomBroadcast.set(key, broadcastRoom);
      socket.join(rooms.voice(key));

      let room = voiceRooms.get(key);
      if (!room) {
        room = new Map();
        voiceRooms.set(key, room);
      }
      const me: Participant = { socketId: socket.id, userId: user.id, displayName: user.displayName, muted: false, deafened: false, speaking: false, video: false };

      const peers = [...room.values()].map((p) => ({ socketId: p.socketId, userId: p.userId, displayName: p.displayName, muted: p.muted, deafened: p.deafened }));
      room.set(socket.id, me);
      socketChannels.set(socket.id, (socketChannels.get(socket.id) ?? new Set()).add(key));

      socket.emit(SocketEvents.VOICE_PEERS, { channelId: key, peers });
      socket.to(rooms.voice(key)).emit(SocketEvents.VOICE_PEER_JOINED, { channelId: key, peer: { socketId: socket.id, userId: user.id, displayName: user.displayName } });
      emitVoiceState(io, key);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ error: (err as Error).message });
    }
  });

  // Relay SDP / ICE between two peers.
  socket.on(SocketEvents.VOICE_SIGNAL, (raw: { targetSocketId?: string; data?: unknown }) => {
    if (!raw?.targetSocketId) return;
    io.to(raw.targetSocketId).emit(SocketEvents.VOICE_SIGNAL, { fromSocketId: socket.id, fromUserId: user.id, data: raw.data });
  });

  socket.on(SocketEvents.VOICE_MUTE, (raw: { channelId?: string; muted?: boolean; deafened?: boolean; video?: boolean }) => {
    const key = raw?.channelId;
    if (!key) return;
    const p = voiceRooms.get(key)?.get(socket.id);
    if (!p) return;
    if (typeof raw.muted === 'boolean') p.muted = raw.muted;
    if (typeof raw.deafened === 'boolean') p.deafened = raw.deafened;
    if (typeof raw.video === 'boolean') p.video = raw.video;
    emitVoiceState(io, key);
  });

  socket.on(SocketEvents.VOICE_SPEAKING, (raw: { channelId?: string; speaking?: boolean }) => {
    const key = raw?.channelId;
    if (!key) return;
    const p = voiceRooms.get(key)?.get(socket.id);
    if (!p) return;
    p.speaking = !!raw.speaking;
    const payload = { channelId: key, userId: user.id, speaking: p.speaking };
    io.to(rooms.voice(key)).emit(SocketEvents.VOICE_SPEAKING, payload);
    const room = roomBroadcast.get(key);
    if (room) io.to(room).emit(SocketEvents.VOICE_SPEAKING, payload);
  });

  socket.on(SocketEvents.VOICE_LEAVE, (raw: { channelId?: string }) => {
    if (raw?.channelId) leaveChannel(io, socket, user, raw.channelId);
  });
}

function leaveChannel(io: IOServer, socket: Socket, user: VoiceUser, key: string) {
  const room = voiceRooms.get(key);
  if (room?.delete(socket.id)) {
    socket.leave(rooms.voice(key));
    socket.to(rooms.voice(key)).emit(SocketEvents.VOICE_PEER_LEFT, { channelId: key, socketId: socket.id, userId: user.id });
    socketChannels.get(socket.id)?.delete(key);
    if (room.size === 0) {
      voiceRooms.delete(key);
      // keep roomBroadcast so a final empty state still fans out, then clear
      emitVoiceState(io, key);
      roomBroadcast.delete(key);
      return;
    }
    emitVoiceState(io, key);
  }
}

export function cleanupVoice(io: IOServer, socket: Socket, user: VoiceUser) {
  const channels = socketChannels.get(socket.id);
  if (!channels) return;
  for (const key of [...channels]) leaveChannel(io, socket, user, key);
  socketChannels.delete(socket.id);
}
