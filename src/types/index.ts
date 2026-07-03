export type * from '@shared/types';
export { SocketEvents } from '@shared/events';
export type { VoiceParticipantState, TypingPayload } from '@shared/events';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'error';
  title: string;
  description?: string;
}

export interface VoiceParticipant {
  userId: string;
  socketId: string;
  displayName: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  video?: boolean;
}

export interface Settings {
  theme: 'dark' | 'light';
  accent: string;
  messageGrouping: boolean;
  showTimestamps: boolean;
  compactMode: boolean;
  soundsEnabled: boolean;
  desktopNotifications: boolean;
  mentionSounds: boolean;
  pushToTalk: boolean;
  pushToTalkKey: string;
  inputVolume: number;
  outputVolume: number;
  inputDeviceId: string;
  outputDeviceId: string;
  language: string;
  reducedMotion: boolean;
}

export type ActiveView = 'server' | 'dms' | 'friends';
