import { create } from 'zustand';
import type { FriendshipDTO, PublicUser } from '@shared/types';
import { api } from '@/lib/api';

interface FriendState {
  friends: FriendshipDTO[];
  loading: boolean;
  load: () => Promise<void>;
  presenceUpdate: (user: PublicUser) => void;
  pendingIncomingCount: () => number;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  loading: false,

  async load() {
    set({ loading: true });
    try {
      const { items } = await api.friends.list();
      set({ friends: items });
    } finally {
      set({ loading: false });
    }
  },

  presenceUpdate(user) {
    set((s) => ({ friends: s.friends.map((f) => (f.user.id === user.id ? { ...f, user } : f)) }));
  },

  pendingIncomingCount() {
    return get().friends.filter((f) => f.status === 'PENDING' && f.direction === 'incoming').length;
  },
}));
