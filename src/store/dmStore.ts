import { create } from 'zustand';
import type { DMChannelDTO, PublicUser, Message } from '@shared/types';
import { api } from '@/lib/api';

interface DMState {
  dms: DMChannelDTO[];
  loading: boolean;
  loadDMs: () => Promise<void>;
  openDM: (userId: string) => Promise<DMChannelDTO>;
  upsertDM: (dm: DMChannelDTO) => void;
  updateLastMessage: (dmId: string, message: Message) => void;
  presenceUpdate: (user: PublicUser) => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  dms: [],
  loading: false,

  async loadDMs() {
    set({ loading: true });
    try {
      const { items } = await api.dms.list();
      set({ dms: items });
    } finally {
      set({ loading: false });
    }
  },

  async openDM(userId) {
    const { dm } = await api.dms.open(userId);
    get().upsertDM(dm);
    return dm;
  },

  upsertDM(dm) {
    set((s) => {
      const exists = s.dms.some((d) => d.id === dm.id);
      return { dms: exists ? s.dms.map((d) => (d.id === dm.id ? dm : d)) : [dm, ...s.dms] };
    });
  },

  updateLastMessage(dmId, message) {
    set((s) => {
      const idx = s.dms.findIndex((d) => d.id === dmId);
      if (idx < 0) return {};
      const dm = { ...s.dms[idx], lastMessage: message };
      const rest = s.dms.filter((d) => d.id !== dmId);
      return { dms: [dm, ...rest] };
    });
  },

  presenceUpdate(user) {
    set((s) => ({
      dms: s.dms.map((d) => ({ ...d, participants: d.participants.map((p) => (p.id === user.id ? user : p)) })),
    }));
  },
}));
