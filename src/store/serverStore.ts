import { create } from 'zustand';
import type { ServerSummary, ServerDetail, Member, Channel, PublicUser, CustomEmoji } from '@shared/types';
import type { VoiceParticipant } from '@/types';
import { api } from '@/lib/api';

interface ServerState {
  servers: ServerSummary[];
  details: Record<string, ServerDetail>;
  members: Record<string, Member[]>;
  emojis: Record<string, CustomEmoji[]>;
  voiceStates: Record<string, VoiceParticipant[]>;
  loadingServers: boolean;

  loadServers: () => Promise<void>;
  loadServer: (id: string) => Promise<ServerDetail | null>;
  loadMembers: (id: string) => Promise<void>;
  loadEmojis: (id: string) => Promise<void>;

  upsertServerSummary: (s: ServerSummary) => void;
  applyServerDetail: (detail: ServerDetail) => void;
  removeServer: (id: string) => void;

  memberJoined: (member: Member) => void;
  memberLeft: (serverId: string, userId: string) => void;
  memberUpdated: (member: Member) => void;
  channelCreated: (channel: Channel) => void;
  channelUpdated: (channel: Channel) => void;
  channelDeleted: (serverId: string, channelId: string) => void;
  presenceUpdate: (user: PublicUser) => void;

  setVoiceState: (channelId: string, participants: VoiceParticipant[]) => void;
  setSpeaking: (channelId: string, userId: string, speaking: boolean) => void;

  getChannel: (channelId: string) => Channel | undefined;
  getServerIdOfChannel: (channelId: string) => string | undefined;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  details: {},
  members: {},
  emojis: {},
  voiceStates: {},
  loadingServers: false,

  async loadServers() {
    set({ loadingServers: true });
    try {
      const { items } = await api.servers.list();
      set({ servers: items });
    } finally {
      set({ loadingServers: false });
    }
  },

  async loadServer(id) {
    try {
      const { server } = await api.servers.get(id);
      set((s) => ({ details: { ...s.details, [id]: server } }));
      return server;
    } catch {
      return null;
    }
  },

  async loadMembers(id) {
    const { items } = await api.servers.members(id);
    set((s) => ({ members: { ...s.members, [id]: items } }));
  },

  async loadEmojis(id) {
    try {
      const { items } = await api.servers.emojis(id);
      set((s) => ({ emojis: { ...s.emojis, [id]: items } }));
    } catch {
      /* no permission or none */
    }
  },

  upsertServerSummary(s) {
    set((state) => {
      const exists = state.servers.some((x) => x.id === s.id);
      return { servers: exists ? state.servers.map((x) => (x.id === s.id ? s : x)) : [...state.servers, s] };
    });
  },

  applyServerDetail(detail) {
    set((s) => ({
      details: { ...s.details, [detail.id]: detail },
      servers: s.servers.map((x) => (x.id === detail.id ? { ...x, name: detail.name, iconUrl: detail.iconUrl, bannerColor: detail.bannerColor, description: detail.description } : x)),
    }));
  },

  removeServer(id) {
    set((s) => {
      const details = { ...s.details };
      delete details[id];
      const members = { ...s.members };
      delete members[id];
      return { servers: s.servers.filter((x) => x.id !== id), details, members };
    });
  },

  memberJoined(member) {
    set((s) => {
      const list = s.members[member.serverId] ?? [];
      if (list.some((m) => m.userId === member.userId)) return {};
      const detail = s.details[member.serverId];
      return {
        members: { ...s.members, [member.serverId]: [...list, member] },
        details: detail ? { ...s.details, [member.serverId]: { ...detail, memberCount: detail.memberCount + 1 } } : s.details,
      };
    });
  },

  memberLeft(serverId, userId) {
    set((s) => {
      const list = s.members[serverId];
      if (!list) return {};
      const detail = s.details[serverId];
      return {
        members: { ...s.members, [serverId]: list.filter((m) => m.userId !== userId) },
        details: detail ? { ...s.details, [serverId]: { ...detail, memberCount: Math.max(0, detail.memberCount - 1) } } : s.details,
      };
    });
  },

  memberUpdated(member) {
    set((s) => {
      const list = s.members[member.serverId];
      if (!list) return {};
      return { members: { ...s.members, [member.serverId]: list.map((m) => (m.userId === member.userId ? member : m)) } };
    });
  },

  channelCreated(channel) {
    set((s) => {
      const detail = s.details[channel.serverId];
      if (!detail || detail.channels.some((c) => c.id === channel.id)) return {};
      return { details: { ...s.details, [channel.serverId]: { ...detail, channels: [...detail.channels, channel] } } };
    });
  },

  channelUpdated(channel) {
    set((s) => {
      const detail = s.details[channel.serverId];
      if (!detail) return {};
      return { details: { ...s.details, [channel.serverId]: { ...detail, channels: detail.channels.map((c) => (c.id === channel.id ? channel : c)) } } };
    });
  },

  channelDeleted(serverId, channelId) {
    set((s) => {
      const detail = s.details[serverId];
      if (!detail) return {};
      return { details: { ...s.details, [serverId]: { ...detail, channels: detail.channels.filter((c) => c.id !== channelId) } } };
    });
  },

  presenceUpdate(user) {
    set((s) => {
      const members = { ...s.members };
      let changed = false;
      for (const serverId of Object.keys(members)) {
        const list = members[serverId];
        if (list.some((m) => m.userId === user.id)) {
          members[serverId] = list.map((m) => (m.userId === user.id ? { ...m, user } : m));
          changed = true;
        }
      }
      return changed ? { members } : {};
    });
  },

  setVoiceState(channelId, participants) {
    set((s) => {
      if (participants.length === 0) {
        const vs = { ...s.voiceStates };
        delete vs[channelId];
        return { voiceStates: vs };
      }
      return { voiceStates: { ...s.voiceStates, [channelId]: participants } };
    });
  },

  setSpeaking(channelId, userId, speaking) {
    set((s) => {
      const list = s.voiceStates[channelId];
      if (!list) return {};
      return { voiceStates: { ...s.voiceStates, [channelId]: list.map((p) => (p.userId === userId ? { ...p, speaking } : p)) } };
    });
  },

  getChannel(channelId) {
    for (const detail of Object.values(get().details)) {
      const c = detail.channels.find((ch) => ch.id === channelId);
      if (c) return c;
    }
    return undefined;
  },

  getServerIdOfChannel(channelId) {
    for (const detail of Object.values(get().details)) {
      if (detail.channels.some((ch) => ch.id === channelId)) return detail.id;
    }
    return undefined;
  },
}));
