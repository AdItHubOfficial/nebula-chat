import type {
  AuthResponse,
  PublicUser,
  ServerSummary,
  ServerDetail,
  Member,
  Channel,
  Category,
  Role,
  Message,
  FriendshipDTO,
  DMChannelDTO,
  Invite,
  AuditEntry,
  CustomEmoji,
  Paginated,
} from '@shared/types';

const TOKEN_KEY = 'nebula.token';

let inMemoryToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return inMemoryToken ?? localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

const get = <T>(p: string) => request<T>('GET', p);
const post = <T>(p: string, b?: unknown) => request<T>('POST', p, b);
const patch = <T>(p: string, b?: unknown) => request<T>('PATCH', p, b);
const del = <T>(p: string, b?: unknown) => request<T>('DELETE', p, b);

export const api = {
  auth: {
    login: (login: string, password: string) => post<AuthResponse>('/auth/login', { login, password }),
    register: (input: { username: string; email: string; password: string; displayName?: string }) =>
      post<AuthResponse>('/auth/register', input),
    me: () => get<{ user: PublicUser }>('/auth/me'),
  },

  users: {
    search: (query: string) => get<{ items: PublicUser[] }>(`/users?query=${encodeURIComponent(query)}`),
    get: (id: string) => get<{ user: PublicUser }>(`/users/${id}`),
    updateMe: (data: Partial<Pick<PublicUser, 'displayName' | 'bio' | 'customStatus' | 'accentColor' | 'bannerColor' | 'avatarUrl' | 'presence'>>) =>
      patch<{ user: PublicUser }>('/users/me', data),
  },

  servers: {
    list: () => get<{ items: ServerSummary[] }>('/servers'),
    create: (input: { name: string; bannerColor?: string; iconUrl?: string }) => post<{ server: ServerDetail }>('/servers', input),
    get: (id: string) => get<{ server: ServerDetail }>(`/servers/${id}`),
    update: (id: string, data: Partial<{ name: string; description: string; bannerColor: string; iconUrl: string | null }>) =>
      patch<{ server: ServerDetail }>(`/servers/${id}`, data),
    remove: (id: string) => del<{ ok: boolean }>(`/servers/${id}`),
    leave: (id: string) => post<{ ok: boolean }>(`/servers/${id}/leave`),
    members: (id: string) => get<{ items: Member[] }>(`/servers/${id}/members`),
    createChannel: (id: string, input: { name: string; type?: string; categoryId?: string | null; topic?: string; isPrivate?: boolean; isNsfw?: boolean }) =>
      post<{ channel: Channel }>(`/servers/${id}/channels`, input),
    createCategory: (id: string, name: string) => post<{ category: Category }>(`/servers/${id}/categories`, { name }),
    updateMember: (id: string, userId: string, data: { nickname?: string | null; roleIds?: string[] }) =>
      patch<{ member: Member }>(`/servers/${id}/members/${userId}`, data),
    kick: (id: string, userId: string) => del<{ ok: boolean }>(`/servers/${id}/members/${userId}`),
    timeout: (id: string, userId: string, minutes: number) => post<{ ok: boolean }>(`/servers/${id}/members/${userId}/timeout`, { minutes }),
    ban: (id: string, userId: string, reason?: string) => post<{ ok: boolean }>(`/servers/${id}/bans`, { userId, reason }),
    bans: (id: string) => get<{ items: Array<{ id: string; reason: string; createdAt: string; user: { id: string; username: string; displayName: string; avatarUrl: string | null } }> }>(`/servers/${id}/bans`),
    unban: (id: string, userId: string) => del<{ ok: boolean }>(`/servers/${id}/bans/${userId}`),
    createRole: (id: string, input: { name: string; color?: string; permissions?: number; hoist?: boolean; mentionable?: boolean }) =>
      post<{ role: Role }>(`/servers/${id}/roles`, input),
    updateRole: (id: string, roleId: string, data: Partial<{ name: string; color: string; permissions: number; hoist: boolean; mentionable: boolean }>) =>
      patch<{ role: Role }>(`/servers/${id}/roles/${roleId}`, data),
    deleteRole: (id: string, roleId: string) => del<{ ok: boolean }>(`/servers/${id}/roles/${roleId}`),
    audit: (id: string) => get<{ items: AuditEntry[] }>(`/servers/${id}/audit`),
    emojis: (id: string) => get<{ items: CustomEmoji[] }>(`/servers/${id}/emojis`),
    createEmoji: (id: string, name: string, url: string) => post<{ emoji: CustomEmoji }>(`/servers/${id}/emojis`, { name, url }),
    deleteEmoji: (id: string, emojiId: string) => del<{ ok: boolean }>(`/servers/${id}/emojis/${emojiId}`),
  },

  channels: {
    update: (channelId: string, data: Partial<{ name: string; topic: string; isNsfw: boolean; isPrivate: boolean; categoryId: string | null; position: number }>) =>
      patch<{ channel: Channel }>(`/channels/${channelId}`, data),
    remove: (channelId: string) => del<{ ok: boolean }>(`/channels/${channelId}`),
    pins: (channelId: string) => get<{ items: Message[] }>(`/channels/${channelId}/pins`),
    updateCategory: (categoryId: string, data: { name?: string; position?: number }) => patch<{ category: Category }>(`/categories/${categoryId}`, data),
    deleteCategory: (categoryId: string) => del<{ ok: boolean }>(`/categories/${categoryId}`),
  },

  messages: {
    channel: (channelId: string, cursor?: string, limit = 40) =>
      get<Paginated<Message>>(`/channels/${channelId}/messages?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
    dm: (dmId: string, cursor?: string, limit = 40) =>
      get<Paginated<Message>>(`/dms/${dmId}/messages?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  },

  friends: {
    list: () => get<{ items: FriendshipDTO[] }>('/friends'),
    request: (username: string) => post<{ ok: boolean }>('/friends/request', { username }),
    accept: (id: string) => post<{ ok: boolean }>(`/friends/${id}/accept`),
    decline: (id: string) => post<{ ok: boolean }>(`/friends/${id}/decline`),
    remove: (id: string) => del<{ ok: boolean }>(`/friends/${id}`),
    block: (userId: string) => post<{ ok: boolean }>('/friends/block', { userId }),
    unblock: (userId: string) => del<{ ok: boolean }>(`/friends/block/${userId}`),
  },

  dms: {
    list: () => get<{ items: DMChannelDTO[] }>('/dms'),
    open: (userId: string) => post<{ dm: DMChannelDTO }>('/dms', { userId }),
    group: (userIds: string[], name?: string) => post<{ dm: DMChannelDTO }>('/dms/group', { userIds, name }),
    get: (id: string) => get<{ dm: DMChannelDTO }>(`/dms/${id}`),
  },

  invites: {
    create: (serverId: string, input?: { maxUses?: number; expiresInHours?: number }) => post<{ invite: Invite }>(`/servers/${serverId}/invites`, input ?? {}),
    list: (serverId: string) => get<{ items: Invite[] }>(`/servers/${serverId}/invites`),
    preview: (code: string) => get<{ invite: { code: string; server: ServerSummary; memberCount: number; inviter: { id: string; displayName: string } } }>(`/invites/${code}`),
    join: (code: string) => post<{ server: ServerSummary | null; already?: boolean }>(`/invites/${code}/join`),
    remove: (code: string) => del<{ ok: boolean }>(`/invites/${code}`),
  },

  search: {
    messages: (params: { q: string; serverId?: string; channelId?: string; from?: string; hasAttachment?: boolean }) => {
      const usp = new URLSearchParams({ q: params.q });
      if (params.serverId) usp.set('serverId', params.serverId);
      if (params.channelId) usp.set('channelId', params.channelId);
      if (params.from) usp.set('from', params.from);
      if (params.hasAttachment) usp.set('hasAttachment', 'true');
      return get<{ items: Array<Message & { channelName: string | null }> }>(`/search/messages?${usp.toString()}`);
    },
    global: (q: string) => get<{ users: PublicUser[]; servers: ServerSummary[]; channels: Channel[] }>(`/search?q=${encodeURIComponent(q)}`),
  },

  admin: {
    setBadges: (userId: string, badges: { verified?: boolean; og?: boolean; adminBadge?: boolean }) =>
      patch<{ user: PublicUser }>(`/admin/users/${userId}/badges`, badges),
  },

  uploads: {
    files: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      return post<{ items: Array<{ url: string; filename: string; mimeType: string; size: number }> }>('/uploads', fd);
    },
    single: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return post<{ url: string; filename: string; mimeType: string; size: number }>('/uploads/single', fd);
    },
  },
};
