import type { Server as IOServer } from 'socket.io';

// Holds the Socket.IO server instance so REST routes can broadcast realtime
// events without a circular dependency on the socket setup module.

let ioRef: IOServer | null = null;

export function setIo(io: IOServer) {
  ioRef = io;
}

export function getIo(): IOServer | null {
  return ioRef;
}

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  server: (serverId: string) => `server:${serverId}`,
  channel: (channelId: string) => `channel:${channelId}`,
  dm: (dmChannelId: string) => `dm:${dmChannelId}`,
  voice: (channelId: string) => `voice:${channelId}`,
};

export function emitToUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(rooms.user(userId)).emit(event, payload);
}
export function emitToServer(serverId: string, event: string, payload: unknown) {
  ioRef?.to(rooms.server(serverId)).emit(event, payload);
}
export function emitToChannel(channelId: string, event: string, payload: unknown) {
  ioRef?.to(rooms.channel(channelId)).emit(event, payload);
}
export function emitToDM(dmChannelId: string, event: string, payload: unknown) {
  ioRef?.to(rooms.dm(dmChannelId)).emit(event, payload);
}

// Live-join every socket a user has to a room (e.g. after they join a server).
export function addUserToRoom(userId: string, room: string) {
  ioRef?.in(rooms.user(userId)).socketsJoin(room);
}
export function removeUserFromRoom(userId: string, room: string) {
  ioRef?.in(rooms.user(userId)).socketsLeave(room);
}
