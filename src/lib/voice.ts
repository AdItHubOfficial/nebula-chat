import { getSocket, emit, emitAck } from './socket';
import { SocketEvents } from '@shared/events';
import { sounds } from './sounds';
import { useUIStore } from '@/store/uiStore';
import { clamp } from './utils';

interface SignalData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

interface PeerState {
  pc: RTCPeerConnection;
  userId: string;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

type Listeners = { onStateChange?: () => void };

export async function listAudioDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [] };
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: devices.filter((d) => d.kind === 'audioinput'),
    outputs: devices.filter((d) => d.kind === 'audiooutput'),
  };
}

export async function ensureMicPermission(): Promise<boolean> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export const canSelectOutput = typeof document !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

// Manages the local mic/camera + a mesh of RTCPeerConnections for a channel or DM call.
class VoiceManager {
  channelId: string | null = null;
  muted = false;
  deafened = false;
  connecting = false;
  videoEnabled = false;
  screenSharing = false;
  mySocketId: string | null = null;

  private localStream: MediaStream | null = null; // processed audio sent to peers
  private rawStream: MediaStream | null = null; // raw mic
  private videoStream: MediaStream | null = null; // local camera
  private peers = new Map<string, PeerState>();
  private audioEls = new Map<string, SinkAudio>();
  private remoteStreams = new Map<string, MediaStream>();
  private volumes = new Map<string, number>();

  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private analyser: AnalyserNode | null = null;

  private speakingTimer: number | null = null;
  private lastSpeaking = false;
  private listeners: Listeners = {};
  private bound = false;

  setListeners(l: Listeners) {
    this.listeners = l;
  }
  private notify() {
    this.listeners.onStateChange?.();
  }
  private settings() {
    return useUIStore.getState().settings;
  }

  // ---- socket signalling ----------------------------------------------
  private bindSocket() {
    if (this.bound) return;
    const socket = getSocket();
    if (!socket) return;
    socket.on(SocketEvents.VOICE_PEERS, this.handlePeers);
    socket.on(SocketEvents.VOICE_PEER_JOINED, this.handlePeerJoined);
    socket.on(SocketEvents.VOICE_PEER_LEFT, this.handlePeerLeft);
    socket.on(SocketEvents.VOICE_SIGNAL, this.handleSignal);
    this.bound = true;
  }
  private unbindSocket() {
    const socket = getSocket();
    if (socket) {
      socket.off(SocketEvents.VOICE_PEERS, this.handlePeers);
      socket.off(SocketEvents.VOICE_PEER_JOINED, this.handlePeerJoined);
      socket.off(SocketEvents.VOICE_PEER_LEFT, this.handlePeerLeft);
      socket.off(SocketEvents.VOICE_SIGNAL, this.handleSignal);
    }
    this.bound = false;
  }

  private emitState() {
    if (this.channelId) emit(SocketEvents.VOICE_MUTE, { channelId: this.channelId, muted: this.muted, deafened: this.deafened, video: this.videoEnabled });
  }

  // ---- local audio pipeline -------------------------------------------
  private async acquireLocal(): Promise<void> {
    const s = this.settings();
    const raw = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: s.inputDeviceId ? { exact: s.inputDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    this.rawStream = raw;
    const ctx = new AudioContext();
    this.audioCtx = ctx;
    const source = ctx.createMediaStreamSource(raw);
    const gain = ctx.createGain();
    gain.gain.value = (s.inputVolume ?? 100) / 100;
    const dest = ctx.createMediaStreamDestination();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(gain).connect(dest);
    source.connect(analyser);
    this.sourceNode = source;
    this.gainNode = gain;
    this.destNode = dest;
    this.analyser = analyser;
    this.localStream = dest.stream;
    raw.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
  }

  private teardownLocal() {
    this.rawStream?.getTracks().forEach((t) => t.stop());
    this.videoStream?.getTracks().forEach((t) => t.stop());
    try {
      this.sourceNode?.disconnect();
      this.gainNode?.disconnect();
      this.analyser?.disconnect();
      this.destNode?.disconnect();
    } catch {
      /* nodes already gone */
    }
    void this.audioCtx?.close().catch(() => {});
    this.rawStream = null;
    this.localStream = null;
    this.videoStream = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.destNode = null;
    this.analyser = null;
  }

  // ---- join / leave ----------------------------------------------------
  join(channelId: string): Promise<void> {
    return this.connect(channelId, { channelId });
  }
  joinDM(dmId: string): Promise<void> {
    return this.connect(dmId, { dmId });
  }

  private async connect(roomKey: string, payload: { channelId?: string; dmId?: string }): Promise<void> {
    if (this.channelId === roomKey) return;
    if (this.channelId) this.leave();
    this.connecting = true;
    this.notify();
    try {
      await this.acquireLocal();
    } catch {
      this.connecting = false;
      this.teardownLocal();
      this.notify();
      throw new Error('Microphone access denied');
    }
    this.channelId = roomKey;
    this.bindSocket();
    this.mySocketId = getSocket()?.id ?? null;
    this.startSpeakingDetection();
    try {
      await emitAck(SocketEvents.VOICE_JOIN, payload);
      sounds.play('join');
    } catch (err) {
      this.leave();
      throw err;
    }
    this.connecting = false;
    this.notify();
  }

  leave() {
    if (this.channelId) emit(SocketEvents.VOICE_LEAVE, { channelId: this.channelId });
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.audioEls.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    this.audioEls.clear();
    this.remoteStreams.clear();
    this.stopSpeakingDetection();
    const wasConnected = !!this.channelId;
    this.teardownLocal();
    if (wasConnected) sounds.play('leave');
    this.channelId = null;
    this.muted = false;
    this.deafened = false;
    this.videoEnabled = false;
    this.screenSharing = false;
    this.mySocketId = null;
    this.unbindSocket();
    this.notify();
  }

  // ---- mute / deafen / camera -----------------------------------------
  setMuted(muted: boolean) {
    this.muted = muted;
    this.rawStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.emitState();
    sounds.play(muted ? 'mute' : 'unmute');
    this.notify();
  }

  setDeafened(deafened: boolean) {
    this.deafened = deafened;
    this.audioEls.forEach((el) => (el.muted = deafened));
    if (deafened && !this.muted) {
      this.muted = true;
      this.rawStream?.getAudioTracks().forEach((t) => (t.enabled = false));
    }
    this.emitState();
    sounds.play('deafen');
    this.notify();
  }

  // Swap the single outgoing video track across all peers (seamless via
  // replaceTrack; add/remove when going from/to no video, which renegotiates).
  private async replaceVideoTrack(stream: MediaStream | null) {
    const track = stream?.getVideoTracks()[0] ?? null;
    for (const { pc } of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (track) {
        if (sender) await sender.replaceTrack(track);
        else pc.addTrack(track, stream!);
      } else if (sender) {
        pc.removeTrack(sender);
      }
    }
  }

  async toggleCamera(): Promise<void> {
    if (!this.channelId) return;
    if (this.videoEnabled && !this.screenSharing) {
      this.videoStream?.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
      this.videoEnabled = false;
      await this.replaceVideoTrack(null);
    } else {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      } catch {
        throw new Error('Camera access denied');
      }
      this.videoStream?.getTracks().forEach((t) => t.stop());
      this.videoStream = stream;
      this.videoEnabled = true;
      this.screenSharing = false;
      await this.replaceVideoTrack(stream);
    }
    this.emitState();
    this.notify();
  }

  async toggleScreenShare(): Promise<void> {
    if (!this.channelId) return;
    if (this.screenSharing) {
      this.videoStream?.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
      this.videoEnabled = false;
      this.screenSharing = false;
      await this.replaceVideoTrack(null);
    } else {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } catch {
        throw new Error('Screen share was cancelled');
      }
      this.videoStream?.getTracks().forEach((t) => t.stop());
      this.videoStream = stream;
      this.videoEnabled = true;
      this.screenSharing = true;
      const track = stream.getVideoTracks()[0];
      // Stop cleanly if the user ends the share from the browser's own bar.
      if (track) track.onended = () => void this.toggleScreenShare();
      await this.replaceVideoTrack(stream);
    }
    this.emitState();
    this.notify();
  }

  getLocalVideoStream(): MediaStream | null {
    return this.videoStream;
  }
  streamForSocket(socketId: string): MediaStream | undefined {
    return this.remoteStreams.get(socketId);
  }

  // ---- device / volume -------------------------------------------------
  setInputVolume(percent: number) {
    if (this.gainNode) this.gainNode.gain.value = clamp(percent, 0, 200) / 100;
  }
  setOutputVolume(_percent: number) {
    for (const [socketId, { userId }] of this.peers) {
      const el = this.audioEls.get(socketId);
      if (el) this.applyOutput(el, userId);
    }
  }
  async setInputDevice(_deviceId: string) {
    if (!this.channelId) return;
    try {
      this.stopSpeakingDetection();
      const keepVideo = this.videoStream;
      this.videoStream = null; // don't stop the camera in teardownLocal
      this.teardownLocal();
      this.videoStream = keepVideo;
      await this.acquireLocal();
      const newTrack = this.localStream?.getAudioTracks()[0] ?? null;
      if (newTrack) {
        for (const { pc } of this.peers.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
          if (sender) await sender.replaceTrack(newTrack);
        }
      }
      this.startSpeakingDetection();
      this.notify();
    } catch {
      /* device unplugged */
    }
  }
  async setOutputDevice(deviceId: string) {
    if (!canSelectOutput) return;
    for (const el of this.audioEls.values()) {
      try {
        await el.setSinkId?.(deviceId);
      } catch {
        /* not allowed */
      }
    }
  }
  private applyOutput(el: SinkAudio, userId: string) {
    const outFactor = (this.settings().outputVolume ?? 100) / 100;
    el.volume = clamp(this.getUserVolume(userId) * outFactor, 0, 1);
    el.muted = this.deafened;
    const sink = this.settings().outputDeviceId;
    if (sink && el.setSinkId) el.setSinkId(sink).catch(() => {});
  }
  setUserVolume(userId: string, volume: number) {
    this.volumes.set(userId, volume);
    for (const [socketId, { userId: uid }] of this.peers) {
      if (uid === userId) {
        const el = this.audioEls.get(socketId);
        if (el) this.applyOutput(el, userId);
      }
    }
  }
  getUserVolume(userId: string): number {
    return this.volumes.get(userId) ?? 1;
  }

  // ---- peer connections (perfect negotiation) -------------------------
  private createPeer(socketId: string, userId: string): PeerState {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const state: PeerState = { pc, userId, polite: (this.mySocketId ?? '') > socketId, makingOffer: false, ignoreOffer: false };
    this.peers.set(socketId, state);

    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    if (this.videoStream) this.videoStream.getVideoTracks().forEach((track) => pc.addTrack(track, this.videoStream!));

    pc.onicecandidate = (e) => {
      if (e.candidate) emit(SocketEvents.VOICE_SIGNAL, { targetSocketId: socketId, data: { candidate: e.candidate.toJSON() } });
    };
    pc.onnegotiationneeded = async () => {
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        emit(SocketEvents.VOICE_SIGNAL, { targetSocketId: socketId, data: { sdp: pc.localDescription ?? undefined } });
      } catch {
        /* ignore */
      } finally {
        state.makingOffer = false;
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) this.remoteStreams.set(socketId, stream);
      if (e.track.kind === 'audio') {
        let el = this.audioEls.get(socketId);
        if (!el) {
          el = new Audio() as SinkAudio;
          el.autoplay = true;
          this.audioEls.set(socketId, el);
        }
        el.srcObject = stream ?? null;
        this.applyOutput(el, userId);
        void el.play().catch(() => {});
      }
      this.notify();
    };
    return state;
  }

  private handlePeers = ({ channelId, peers }: { channelId: string; peers: Array<{ socketId: string; userId: string }> }) => {
    if (channelId !== this.channelId) return;
    for (const peer of peers) this.createPeer(peer.socketId, peer.userId);
  };

  private handlePeerJoined = ({ channelId }: { channelId: string }) => {
    if (channelId !== this.channelId) return;
    sounds.play('join');
    // The newcomer initiates; we respond when their offer arrives.
  };

  private handlePeerLeft = ({ socketId }: { socketId: string }) => {
    const entry = this.peers.get(socketId);
    if (entry) {
      entry.pc.close();
      this.peers.delete(socketId);
    }
    const el = this.audioEls.get(socketId);
    if (el) {
      el.srcObject = null;
      el.remove();
      this.audioEls.delete(socketId);
    }
    this.remoteStreams.delete(socketId);
    sounds.play('leave');
    this.notify();
  };

  private handleSignal = async ({ fromSocketId, fromUserId, data }: { fromSocketId: string; fromUserId: string; data: SignalData }) => {
    let state = this.peers.get(fromSocketId);
    if (!state) state = this.createPeer(fromSocketId, fromUserId);
    const { pc } = state;
    try {
      if (data.sdp) {
        const offerCollision = data.sdp.type === 'offer' && (state.makingOffer || pc.signalingState !== 'stable');
        state.ignoreOffer = !state.polite && offerCollision;
        if (state.ignoreOffer) return;
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          await pc.setLocalDescription();
          emit(SocketEvents.VOICE_SIGNAL, { targetSocketId: fromSocketId, data: { sdp: pc.localDescription ?? undefined } });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          if (!state.ignoreOffer) throw err;
        }
      }
    } catch {
      /* negotiation error */
    }
  };

  // ---- speaking detection ---------------------------------------------
  private startSpeakingDetection() {
    if (!this.analyser) return;
    const analyser = this.analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    this.speakingTimer = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      const speaking = !this.muted && avg > 12;
      if (speaking !== this.lastSpeaking) {
        this.lastSpeaking = speaking;
        if (this.channelId) emit(SocketEvents.VOICE_SPEAKING, { channelId: this.channelId, speaking });
      }
    }, 150);
  }

  private stopSpeakingDetection() {
    if (this.speakingTimer) window.clearInterval(this.speakingTimer);
    this.speakingTimer = null;
    this.lastSpeaking = false;
  }
}

export const voice = new VoiceManager();
