// Canonical Socket.IO event names shared by client + server.

export const SocketEvents = {
  // lifecycle
  READY: 'ready',
  ERROR: 'error',

  // presence
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_SYNC: 'presence:sync',

  // room subscription
  SUBSCRIBE_CHANNEL: 'channel:subscribe',
  UNSUBSCRIBE_CHANNEL: 'channel:unsubscribe',

  // messages
  MESSAGE_CREATE: 'message:create',
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_PIN: 'message:pin',
  MESSAGE_PINNED: 'message:pinned',

  // reactions
  REACTION_ADD: 'reaction:add',
  REACTION_REMOVE: 'reaction:remove',
  REACTION_UPDATED: 'reaction:updated',

  // typing
  TYPING_START: 'typing:start',
  TYPING_UPDATE: 'typing:update',

  // read state
  READ_ACK: 'read:ack',
  READ_UPDATED: 'read:updated',

  // servers / members
  SERVER_UPDATED: 'server:updated',
  SERVER_DELETED: 'server:deleted',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  MEMBER_UPDATED: 'member:updated',
  CHANNEL_CREATED: 'channel:created',
  CHANNEL_UPDATED: 'channel:updated',
  CHANNEL_DELETED: 'channel:deleted',

  // friends / dms
  FRIEND_UPDATE: 'friend:update',
  DM_CREATED: 'dm:created',

  // voice
  VOICE_JOIN: 'voice:join',
  VOICE_LEAVE: 'voice:leave',
  VOICE_STATE: 'voice:state',
  VOICE_PEERS: 'voice:peers',
  VOICE_PEER_JOINED: 'voice:peer-joined',
  VOICE_PEER_LEFT: 'voice:peer-left',
  VOICE_SIGNAL: 'voice:signal',
  VOICE_SPEAKING: 'voice:speaking',
  VOICE_MUTE: 'voice:mute',
} as const;

export interface VoiceParticipantState {
  userId: string;
  socketId: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

export interface TypingPayload {
  channelId: string;
  userId: string;
  displayName: string;
}
