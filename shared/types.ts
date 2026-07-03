// DTO shapes shared between the API and the client.

export type PresenceState = 'ONLINE' | 'IDLE' | 'DND' | 'INVISIBLE' | 'OFFLINE';
export type ChannelType = 'TEXT' | 'VOICE' | 'ANNOUNCEMENT';
export type FriendStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerColor: string;
  accentColor: string;
  bio: string;
  customStatus: string;
  presence: PresenceState;
  verified: boolean;
  og: boolean;
  adminBadge: boolean;
  siteAdmin: boolean;
  // live connection status computed by the presence service
  online?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  permissions: number;
  hoist: boolean;
  mentionable: boolean;
  isDefault: boolean;
}

export interface Member {
  id: string; // ServerMember id
  userId: string;
  serverId: string;
  nickname: string | null;
  joinedAt: string;
  timeoutUntil: string | null;
  roles: string[]; // role ids
  user: PublicUser;
}

export interface Category {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  topic: string;
  position: number;
  isPrivate: boolean;
  isNsfw: boolean;
}

export interface ServerSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerColor: string;
  description: string;
  ownerId: string;
}

export interface ServerDetail extends ServerSummary {
  categories: Category[];
  channels: Channel[];
  roles: Role[];
  memberCount: number;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  me: boolean;
}

export interface Message {
  id: string;
  channelId: string | null;
  dmChannelId: string | null;
  authorId: string;
  author: PublicUser;
  content: string;
  type: 'DEFAULT' | 'SYSTEM';
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  replyToId: string | null;
  replyTo: MessagePreview | null;
  attachments: Attachment[];
  reactions: ReactionGroup[];
}

export interface MessagePreview {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
}

export interface Invite {
  code: string;
  serverId: string;
  inviterId: string;
  uses: number;
  maxUses: number;
  createdAt: string;
  expiresAt: string | null;
  server?: ServerSummary;
}

export interface DMChannelDTO {
  id: string;
  isGroup: boolean;
  name: string | null;
  ownerId: string | null;
  participants: PublicUser[];
  lastMessage: Message | null;
}

export interface FriendshipDTO {
  id: string;
  status: FriendStatus;
  direction: 'incoming' | 'outgoing' | 'mutual';
  user: PublicUser;
  createdAt: string;
}

export interface CustomEmoji {
  id: string;
  serverId: string;
  name: string;
  url: string;
}

export interface AuditEntry {
  id: string;
  serverId: string;
  actorId: string;
  actor: PublicUser;
  action: string;
  targetId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
}
