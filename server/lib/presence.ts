// In-memory presence registry: which users currently have a live socket.
// Chosen presence (ONLINE/IDLE/DND/INVISIBLE) lives in the DB; this tracks
// actual connectivity so we can compute an effective presence.

const socketsByUser = new Map<string, Set<string>>();

export function addConnection(userId: string, socketId: string): boolean {
  let set = socketsByUser.get(userId);
  const wasOffline = !set || set.size === 0;
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(socketId);
  return wasOffline;
}

export function removeConnection(userId: string, socketId: string): boolean {
  const set = socketsByUser.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    socketsByUser.delete(userId);
    return true; // now fully offline
  }
  return false;
}

export function isOnline(userId: string): boolean {
  const set = socketsByUser.get(userId);
  return !!set && set.size > 0;
}

export function onlineUserIds(): string[] {
  return [...socketsByUser.keys()];
}

export function getSocketIds(userId: string): string[] {
  return [...(socketsByUser.get(userId) ?? [])];
}
