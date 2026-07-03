import { create } from 'zustand';
import type { Message, ReactionGroup } from '@shared/types';
import { useAuthStore } from './authStore';

export type ClientMessage = Message & { pending?: boolean; failed?: boolean; nonce?: string };

interface Convo {
  messages: ClientMessage[];
  hasMore: boolean;
  loading: boolean;
  loadedOnce: boolean;
}

interface TypingEntry {
  displayName: string;
  expires: number;
}

const emptyConvo: Convo = { messages: [], hasMore: false, loading: false, loadedOnce: false };

interface MessageState {
  convos: Record<string, Convo>;
  typing: Record<string, Record<string, TypingEntry>>;
  unread: Record<string, number>;
  mentions: Record<string, number>;
  dmReadReceipts: Record<string, Record<string, string>>;
  replyingTo: Record<string, { id: string; authorName: string; content: string } | null>;
  activeKey: string | null;

  setReplyingTo: (key: string, value: { id: string; authorName: string; content: string } | null) => void;
  setActive: (key: string | null) => void;
  setConvo: (key: string, patch: Partial<Convo>) => void;
  setInitial: (key: string, messages: Message[], hasMore: boolean) => void;
  prependOlder: (key: string, messages: Message[], hasMore: boolean) => void;

  addOptimistic: (key: string, message: ClientMessage) => void;
  markFailed: (key: string, nonce: string) => void;
  receiveMessage: (message: Message, nonce?: string) => void;
  updateMessage: (message: Message) => void;
  deleteMessage: (messageId: string, channelId?: string | null, dmChannelId?: string | null) => void;
  setPinned: (messageId: string, pinned: boolean, key: string) => void;
  applyReaction: (messageId: string, emoji: string, userId: string, add: boolean) => void;

  setTyping: (key: string, userId: string, displayName: string) => void;
  clearTyping: (key: string, userId: string) => void;

  markRead: (key: string) => void;
  addUnread: (key: string, mention: boolean) => void;
  setDmReceipt: (dmKey: string, userId: string, at: string) => void;
  findKeyByMessage: (messageId: string) => string | null;
}

function keyOf(m: { channelId: string | null; dmChannelId: string | null }): string {
  return m.channelId ?? m.dmChannelId ?? '';
}

export const useMessageStore = create<MessageState>((set, get) => ({
  convos: {},
  typing: {},
  unread: {},
  mentions: {},
  dmReadReceipts: {},
  replyingTo: {},
  activeKey: null,

  setReplyingTo(key, value) {
    set((s) => ({ replyingTo: { ...s.replyingTo, [key]: value } }));
  },

  setActive(key) {
    set({ activeKey: key });
    if (key) get().markRead(key);
  },

  setConvo(key, patch) {
    set((s) => ({ convos: { ...s.convos, [key]: { ...(s.convos[key] ?? emptyConvo), ...patch } } }));
  },

  setInitial(key, messages, hasMore) {
    set((s) => ({ convos: { ...s.convos, [key]: { messages, hasMore, loading: false, loadedOnce: true } } }));
  },

  prependOlder(key, messages, hasMore) {
    set((s) => {
      const convo = s.convos[key] ?? emptyConvo;
      const existing = new Set(convo.messages.map((m) => m.id));
      const merged = [...messages.filter((m) => !existing.has(m.id)), ...convo.messages];
      return { convos: { ...s.convos, [key]: { ...convo, messages: merged, hasMore, loading: false } } };
    });
  },

  addOptimistic(key, message) {
    set((s) => {
      const convo = s.convos[key] ?? emptyConvo;
      return { convos: { ...s.convos, [key]: { ...convo, messages: [...convo.messages, message], loadedOnce: true } } };
    });
  },

  markFailed(key, nonce) {
    set((s) => {
      const convo = s.convos[key];
      if (!convo) return {};
      return { convos: { ...s.convos, [key]: { ...convo, messages: convo.messages.map((m) => (m.nonce === nonce ? { ...m, pending: false, failed: true } : m)) } } };
    });
  },

  receiveMessage(message, nonce) {
    const key = keyOf(message);
    const myId = useAuthStore.getState().user?.id;
    set((s) => {
      const convo = s.convos[key] ?? emptyConvo;
      // Replace a matching optimistic message.
      if (nonce) {
        const idx = convo.messages.findIndex((m) => m.nonce === nonce);
        if (idx >= 0) {
          const next = convo.messages.slice();
          next[idx] = { ...message };
          return { convos: { ...s.convos, [key]: { ...convo, messages: next } } };
        }
      }
      if (convo.messages.some((m) => m.id === message.id)) return {};
      return { convos: { ...s.convos, [key]: { ...convo, messages: [...convo.messages, message], loadedOnce: convo.loadedOnce } } };
    });
    // Unread accounting handled by realtime layer via addUnread; only self auto-reads active.
    if (message.authorId === myId && get().activeKey === key) get().markRead(key);
  },

  updateMessage(message) {
    const key = keyOf(message);
    set((s) => {
      const convo = s.convos[key];
      if (!convo) return {};
      return { convos: { ...s.convos, [key]: { ...convo, messages: convo.messages.map((m) => (m.id === message.id ? { ...message, nonce: m.nonce } : m)) } } };
    });
  },

  deleteMessage(messageId, channelId, dmChannelId) {
    const key = channelId ?? dmChannelId ?? get().findKeyByMessage(messageId);
    if (!key) return;
    set((s) => {
      const convo = s.convos[key];
      if (!convo) return {};
      return { convos: { ...s.convos, [key]: { ...convo, messages: convo.messages.filter((m) => m.id !== messageId) } } };
    });
  },

  setPinned(messageId, pinned, key) {
    set((s) => {
      const convo = s.convos[key];
      if (!convo) return {};
      return { convos: { ...s.convos, [key]: { ...convo, messages: convo.messages.map((m) => (m.id === messageId ? { ...m, pinned } : m)) } } };
    });
  },

  applyReaction(messageId, emoji, userId, add) {
    const myId = useAuthStore.getState().user?.id;
    set((s) => {
      const convos = { ...s.convos };
      for (const key of Object.keys(convos)) {
        const convo = convos[key];
        const idx = convo.messages.findIndex((m) => m.id === messageId);
        if (idx < 0) continue;
        const msg = convo.messages[idx];
        const reactions = applyReactionGroups(msg.reactions, emoji, userId, add, userId === myId);
        const next = convo.messages.slice();
        next[idx] = { ...msg, reactions };
        convos[key] = { ...convo, messages: next };
        return { convos };
      }
      return {};
    });
  },

  setTyping(key, userId, displayName) {
    set((s) => ({
      typing: { ...s.typing, [key]: { ...(s.typing[key] ?? {}), [userId]: { displayName, expires: Date.now() + 6000 } } },
    }));
    setTimeout(() => get().clearTyping(key, userId), 6200);
  },

  clearTyping(key, userId) {
    set((s) => {
      const entry = s.typing[key];
      if (!entry || !entry[userId]) return {};
      if (entry[userId].expires > Date.now()) return {};
      const nextEntry = { ...entry };
      delete nextEntry[userId];
      return { typing: { ...s.typing, [key]: nextEntry } };
    });
  },

  markRead(key) {
    set((s) => (s.unread[key] || s.mentions[key] ? { unread: { ...s.unread, [key]: 0 }, mentions: { ...s.mentions, [key]: 0 } } : {}));
  },

  addUnread(key, mention) {
    if (get().activeKey === key && document.hasFocus()) return;
    set((s) => ({
      unread: { ...s.unread, [key]: (s.unread[key] ?? 0) + 1 },
      mentions: mention ? { ...s.mentions, [key]: (s.mentions[key] ?? 0) + 1 } : s.mentions,
    }));
  },

  setDmReceipt(dmKey, userId, at) {
    set((s) => ({ dmReadReceipts: { ...s.dmReadReceipts, [dmKey]: { ...(s.dmReadReceipts[dmKey] ?? {}), [userId]: at } } }));
  },

  findKeyByMessage(messageId) {
    for (const [key, convo] of Object.entries(get().convos)) {
      if (convo.messages.some((m) => m.id === messageId)) return key;
    }
    return null;
  },
}));

function applyReactionGroups(groups: ReactionGroup[], emoji: string, userId: string, add: boolean, isMe: boolean): ReactionGroup[] {
  const next = groups.map((g) => ({ ...g, userIds: [...g.userIds] }));
  const existing = next.find((g) => g.emoji === emoji);
  if (add) {
    if (existing) {
      if (!existing.userIds.includes(userId)) {
        existing.userIds.push(userId);
        existing.count += 1;
        if (isMe) existing.me = true;
      }
    } else {
      next.push({ emoji, count: 1, userIds: [userId], me: isMe });
    }
  } else if (existing) {
    existing.userIds = existing.userIds.filter((u) => u !== userId);
    existing.count = existing.userIds.length;
    if (isMe) existing.me = false;
  }
  return next.filter((g) => g.count > 0);
}
