import { create } from 'zustand';
import { voice } from '@/lib/voice';
import { sounds } from '@/lib/sounds';
import { toast } from './toastStore';

export interface IncomingCall {
  dmId: string;
  callerId: string;
  callerName: string;
}

interface VoiceState {
  channelId: string | null;
  connecting: boolean;
  muted: boolean;
  deafened: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
  tick: number;
  incomingCall: IncomingCall | null;
  join: (channelId: string) => Promise<void>;
  joinDM: (dmId: string) => Promise<void>;
  leave: () => void;
  setIncomingCall: (call: IncomingCall) => void;
  clearIncomingCall: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setUserVolume: (userId: string, volume: number) => void;
  getUserVolume: (userId: string) => number;
  sync: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  channelId: null,
  connecting: false,
  muted: false,
  deafened: false,
  videoEnabled: false,
  screenSharing: false,
  tick: 0,
  incomingCall: null,

  setIncomingCall(call) {
    set({ incomingCall: call });
    sounds.startRingtone();
  },
  clearIncomingCall() {
    sounds.stopRingtone();
    set({ incomingCall: null });
  },

  async join(channelId) {
    try {
      await voice.join(channelId);
    } catch (err) {
      toast.error('Voice error', (err as Error).message);
    }
  },
  async joinDM(dmId) {
    try {
      await voice.joinDM(dmId);
    } catch (err) {
      toast.error('Call error', (err as Error).message);
    }
  },
  leave() {
    voice.leave();
  },
  toggleMute() {
    voice.setMuted(!voice.muted);
  },
  toggleDeafen() {
    voice.setDeafened(!voice.deafened);
  },
  async toggleCamera() {
    try {
      await voice.toggleCamera();
    } catch (err) {
      toast.error('Camera error', (err as Error).message);
    }
  },
  async toggleScreenShare() {
    try {
      await voice.toggleScreenShare();
    } catch (err) {
      toast.error('Screen share error', (err as Error).message);
    }
  },
  setUserVolume(userId, volume) {
    voice.setUserVolume(userId, volume);
    set((s) => ({ tick: s.tick + 1 }));
  },
  getUserVolume(userId) {
    return voice.getUserVolume(userId);
  },
  sync() {
    set((s) => ({
      channelId: voice.channelId,
      connecting: voice.connecting,
      muted: voice.muted,
      deafened: voice.deafened,
      videoEnabled: voice.videoEnabled,
      screenSharing: voice.screenSharing,
      tick: s.tick + 1,
    }));
  },
}));

voice.setListeners({ onStateChange: () => useVoiceStore.getState().sync() });
