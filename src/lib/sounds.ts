// Lightweight synthesized UI sounds via the Web Audio API — no asset files.

type SoundName = 'message' | 'mention' | 'join' | 'leave' | 'mute' | 'unmute' | 'deafen' | 'pop' | 'error' | 'ring';

let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.14) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.02);
}

const patterns: Record<SoundName, () => void> = {
  message: () => tone(523.25, 0, 0.12, 'sine', 0.08),
  pop: () => tone(660, 0, 0.09, 'triangle', 0.09),
  mention: () => {
    tone(659.25, 0, 0.13, 'sine', 0.11);
    tone(987.77, 0.1, 0.16, 'sine', 0.11);
  },
  join: () => {
    tone(440, 0, 0.12, 'sine', 0.12);
    tone(660, 0.09, 0.16, 'sine', 0.12);
  },
  leave: () => {
    tone(660, 0, 0.12, 'sine', 0.12);
    tone(440, 0.09, 0.18, 'sine', 0.12);
  },
  mute: () => tone(330, 0, 0.1, 'square', 0.06),
  unmute: () => tone(520, 0, 0.1, 'square', 0.06),
  deafen: () => tone(220, 0, 0.14, 'sawtooth', 0.05),
  error: () => {
    tone(220, 0, 0.16, 'sawtooth', 0.08);
    tone(180, 0.08, 0.2, 'sawtooth', 0.08);
  },
  ring: () => {
    // A gentle two-note phone-style ring.
    tone(587.33, 0, 0.22, 'sine', 0.1);
    tone(880, 0.16, 0.28, 'sine', 0.1);
  },
};

export const sounds = {
  setEnabled(v: boolean) {
    enabled = v;
  },
  play(name: SoundName) {
    if (!enabled) return;
    try {
      patterns[name]?.();
    } catch {
      /* audio not available */
    }
  },
  // Must be called from a user gesture to unlock audio on some browsers.
  unlock() {
    ac();
  },
};
