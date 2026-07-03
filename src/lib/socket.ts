import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 4000,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// Emit with an acknowledgement, resolving/rejecting from the server response.
export function emitAck<T = unknown>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Not connected'));
    socket.timeout(8000).emit(event, payload, (err: Error | null, response: { ok?: boolean; error?: string } & T) => {
      if (err) return reject(err);
      if (response && response.error) return reject(new Error(response.error));
      resolve(response as T);
    });
  });
}

export function emit(event: string, payload?: unknown) {
  socket?.emit(event, payload);
}
