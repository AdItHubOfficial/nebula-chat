import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';
import { hexToRgbTriplet, clamp } from '@/lib/utils';
import { sounds } from '@/lib/sounds';

export const ACCENT_PRESETS: { name: string; value: string; secondary: string }[] = [
  { name: 'Nebula', value: '#8b5cf6', secondary: '#ec4899' },
  { name: 'Aurora', value: '#22d3ee', secondary: '#3b82f6' },
  { name: 'Mint', value: '#34d399', secondary: '#10b981' },
  { name: 'Sunset', value: '#f59e0b', secondary: '#ef4444' },
  { name: 'Rose', value: '#f472b6', secondary: '#a855f7' },
  { name: 'Blossom', value: '#fb7185', secondary: '#f43f5e' },
  { name: 'Ocean', value: '#38bdf8', secondary: '#6366f1' },
];

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: '#8b5cf6',
  messageGrouping: true,
  showTimestamps: true,
  compactMode: false,
  soundsEnabled: true,
  desktopNotifications: true,
  mentionSounds: true,
  pushToTalk: false,
  pushToTalkKey: 'Space',
  inputVolume: 100,
  outputVolume: 100,
  inputDeviceId: '',
  outputDeviceId: '',
  language: 'en',
  reducedMotion: false,
};

interface UIState {
  settings: Settings;
  channelWidth: number;
  memberWidth: number;
  memberListOpen: boolean;
  lastServerId: string | null;
  lastChannelByServer: Record<string, string>;
  drafts: Record<string, string>;
  updateSettings: (partial: Partial<Settings>) => void;
  applyTheme: () => void;
  setChannelWidth: (w: number) => void;
  setMemberWidth: (w: number) => void;
  toggleMemberList: () => void;
  setLastServer: (id: string | null) => void;
  setLastChannel: (serverId: string, channelId: string) => void;
  setDraft: (key: string, value: string) => void;
  getDraft: (key: string) => string;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      channelWidth: 248,
      memberWidth: 248,
      memberListOpen: true,
      lastServerId: null,
      lastChannelByServer: {},
      drafts: {},

      updateSettings(partial) {
        set((s) => ({ settings: { ...s.settings, ...partial } }));
        get().applyTheme();
      },

      applyTheme() {
        const { settings } = get();
        const root = document.documentElement;
        root.setAttribute('data-theme', settings.theme);
        root.style.setProperty('--c-accent', hexToRgbTriplet(settings.accent));
        const preset = ACCENT_PRESETS.find((p) => p.value === settings.accent);
        root.style.setProperty('--c-accent-2', hexToRgbTriplet(preset?.secondary ?? settings.accent));
        root.style.setProperty('--motion', settings.reducedMotion ? '0' : '1');
        sounds.setEnabled(settings.soundsEnabled);
      },

      setChannelWidth(w) {
        set({ channelWidth: clamp(w, 180, 420) });
      },
      setMemberWidth(w) {
        set({ memberWidth: clamp(w, 200, 400) });
      },
      toggleMemberList() {
        set((s) => ({ memberListOpen: !s.memberListOpen }));
      },
      setLastServer(id) {
        set({ lastServerId: id });
      },
      setLastChannel(serverId, channelId) {
        set((s) => ({ lastChannelByServer: { ...s.lastChannelByServer, [serverId]: channelId } }));
      },
      setDraft(key, value) {
        set((s) => {
          const drafts = { ...s.drafts };
          if (value.trim()) drafts[key] = value;
          else delete drafts[key];
          return { drafts };
        });
      },
      getDraft(key) {
        return get().drafts[key] ?? '';
      },
    }),
    {
      name: 'nebula.ui',
      version: 1,
      // Ensure older saved settings pick up new fields + notifications-on default.
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as { settings?: Partial<Settings> };
        state.settings = { ...DEFAULT_SETTINGS, ...state.settings, desktopNotifications: true };
        return state;
      },
      partialize: (s) => ({
        settings: s.settings,
        channelWidth: s.channelWidth,
        memberWidth: s.memberWidth,
        memberListOpen: s.memberListOpen,
        lastServerId: s.lastServerId,
        lastChannelByServer: s.lastChannelByServer,
        drafts: s.drafts,
      }),
    },
  ),
);
