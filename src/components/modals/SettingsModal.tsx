import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import {
  User as UserIcon,
  Palette,
  Bell,
  Mic,
  Keyboard,
  Languages,
  ShieldCheck,
  LogOut,
  Upload,
  Loader2,
  Check,
  type LucideIcon,
} from 'lucide-react';
import type { PresenceState } from '@shared/types';
import type { Settings } from '@/types';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore, ACCENT_PRESETS } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { api } from '@/lib/api';
import { cn, PRESENCE_META } from '@/lib/utils';
import { voice, listAudioDevices, ensureMicPermission, canSelectOutput } from '@/lib/voice';
import { Volume2, Headphones } from 'lucide-react';

type TabId =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'voice'
  | 'keybinds'
  | 'language'
  | 'privacy';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'account', label: 'My Account', icon: UserIcon },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'voice', label: 'Voice & Audio', icon: Mic },
  { id: 'keybinds', label: 'Keybinds', icon: Keyboard },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
];

const PRESENCE_OPTIONS: PresenceState[] = ['ONLINE', 'IDLE', 'DND', 'INVISIBLE'];

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
];

const KEYBINDS: { keys: string; label: string }[] = [
  { keys: 'Ctrl/Cmd + K', label: 'Quick Switcher' },
  { keys: 'Esc', label: 'Close' },
  { keys: 'Shift + Esc', label: 'Mark read' },
  { keys: 'Ctrl/Cmd + /', label: 'Shortcuts' },
];

/* -------------------------------------------------------------------------- */
/*  Toggle switch                                                              */
/* -------------------------------------------------------------------------- */

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-accent' : 'bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          checked ? 'ml-6' : 'ml-1',
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout helpers                                                             */
/* -------------------------------------------------------------------------- */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-base font-bold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Panels                                                                     */
/* -------------------------------------------------------------------------- */

function AccountPanel() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [presence, setPresence] = useState<PresenceState>(user?.presence ?? 'ONLINE');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploads.single(file);
      await api.users.updateMe({ avatarUrl: url });
      patchUser({ avatarUrl: url });
      toast.success('Avatar updated');
    } catch {
      toast.error('Could not update avatar');
    } finally {
      setUploading(false);
    }
  }

  async function onSelectPresence(next: PresenceState) {
    setPresence(next);
    try {
      await api.users.updateMe({ presence: next });
      patchUser({ presence: next });
    } catch {
      toast.error('Could not update status');
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const { user: updated } = await api.users.updateMe({ displayName, bio, customStatus });
      patchUser({ displayName: updated.displayName, bio: updated.bio, customStatus: updated.customStatus });
      toast.success('Profile saved');
    } catch {
      toast.error('Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="My Account" description="Manage how others see you across Nebula.">
        <div className="flex items-center gap-4 rounded-2xl bg-surface-2/60 border border-line/50 p-4">
          <Avatar
            userId={user?.id ?? 'me'}
            name={displayName || user?.username || 'You'}
            src={user?.avatarUrl}
            size={64}
            presence={presence}
            showPresence
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-content">{displayName || user?.username}</p>
            <p className="truncate text-xs text-muted">@{user?.username}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          <button
            type="button"
            className="btn-soft"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading…' : 'Change avatar'}
          </button>
        </div>
      </Section>

      <div className="space-y-4">
        <Field label="Display name">
          <input
            className="input"
            value={displayName}
            maxLength={64}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </Field>

        <Field label="Custom status">
          <input
            className="input"
            value={customStatus}
            maxLength={128}
            onChange={(e) => setCustomStatus(e.target.value)}
            placeholder="What's on your mind?"
          />
        </Field>

        <Field label="About me">
          <textarea
            className="input min-h-[96px] resize-y"
            value={bio}
            maxLength={512}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people a little about yourself"
          />
        </Field>
      </div>

      <Section title="Status" description="Set how your presence appears to others.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESENCE_OPTIONS.map((option) => {
            const meta = PRESENCE_META[option];
            const active = presence === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectPresence(option)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition',
                  active
                    ? 'border-accent/70 bg-accent/15 text-content'
                    : 'border-line/50 bg-surface-2/60 text-muted hover:text-content hover:bg-surface-2',
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                <span className="truncate">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="flex justify-end pt-1">
        <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save changes
        </button>
      </div>
    </div>
  );
}

function AppearancePanel() {
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);

  return (
    <div className="space-y-6">
      <Section title="Theme" description="Choose a light or dark canvas.">
        <div className="grid grid-cols-2 gap-2">
          {(['dark', 'light'] as const).map((theme) => {
            const active = settings.theme === theme;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => updateSettings({ theme })}
                className={cn(
                  'flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium capitalize transition',
                  active
                    ? 'border-accent/70 bg-accent/15 text-content'
                    : 'border-line/50 bg-surface-2/60 text-muted hover:text-content hover:bg-surface-2',
                )}
              >
                {theme}
                {active && <Check size={16} className="text-accent" />}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Accent color" description="Personalize your Nebula highlight.">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {ACCENT_PRESETS.map((preset) => {
            const active = settings.accent === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                onClick={() => updateSettings({ accent: preset.value })}
                className={cn(
                  'relative grid aspect-square place-items-center rounded-2xl transition ring-offset-2 ring-offset-surface-2',
                  active ? 'ring-2 ring-white/80 scale-105' : 'hover:scale-105',
                )}
                style={{ backgroundImage: `linear-gradient(135deg, ${preset.value}, ${preset.secondary})` }}
              >
                {active && <Check size={18} className="text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Chat" description="Fine-tune how messages are displayed.">
        <div className="space-y-2">
          <ToggleRow
            title="Message grouping"
            description="Stack consecutive messages from the same person."
            checked={settings.messageGrouping}
            onChange={(v) => updateSettings({ messageGrouping: v })}
          />
          <ToggleRow
            title="Show timestamps"
            description="Display the time next to every message."
            checked={settings.showTimestamps}
            onChange={(v) => updateSettings({ showTimestamps: v })}
          />
          <ToggleRow
            title="Compact mode"
            description="Tighten spacing to fit more on screen."
            checked={settings.compactMode}
            onChange={(v) => updateSettings({ compactMode: v })}
          />
          <ToggleRow
            title="Reduced motion"
            description="Minimize animations across the app."
            checked={settings.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
          />
        </div>
      </Section>
    </div>
  );
}

function NotificationsPanel() {
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);

  async function onToggleDesktop(next: boolean) {
    if (next && typeof Notification !== 'undefined') {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Notifications blocked', 'Enable them in your browser settings.');
          updateSettings({ desktopNotifications: false });
          return;
        }
      } catch {
        /* ignore — fall through and still store the preference */
      }
    }
    updateSettings({ desktopNotifications: next });
  }

  return (
    <div className="space-y-6">
      <Section title="Notifications" description="Control how Nebula reaches out to you.">
        <div className="space-y-2">
          <ToggleRow
            title="Desktop notifications"
            description="Show system alerts for new activity."
            checked={settings.desktopNotifications}
            onChange={onToggleDesktop}
          />
          <ToggleRow
            title="Sounds"
            description="Play sound effects for events."
            checked={settings.soundsEnabled}
            onChange={(v) => updateSettings({ soundsEnabled: v })}
          />
          <ToggleRow
            title="Mention sounds"
            description="Play a chime when you're mentioned."
            checked={settings.mentionSounds}
            onChange={(v) => updateSettings({ mentionSounds: v })}
          />
        </div>
      </Section>
    </div>
  );
}

function VoicePanel() {
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const testRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);

  const refresh = async () => {
    const devices = await listAudioDevices();
    setInputs(devices.inputs);
    setOutputs(devices.outputs);
    setNeedsPermission(devices.inputs.length > 0 && devices.inputs.every((d) => !d.label));
  };

  const stopTest = () => {
    const t = testRef.current;
    if (t) {
      cancelAnimationFrame(t.raf);
      t.stream.getTracks().forEach((x) => x.stop());
      void t.ctx.close().catch(() => {});
      testRef.current = null;
    }
    setTesting(false);
    setLevel(0);
  };

  useEffect(() => {
    void refresh();
    const md = navigator.mediaDevices;
    md?.addEventListener?.('devicechange', refresh);
    return () => {
      md?.removeEventListener?.('devicechange', refresh);
      stopTest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 128;
        setLevel(Math.min(1, avg * (settings.inputVolume / 100)));
        if (testRef.current) testRef.current.raf = requestAnimationFrame(loop);
      };
      testRef.current = { stream, ctx, raf: requestAnimationFrame(loop) };
      setTesting(true);
      void refresh();
    } catch {
      toast.error('Microphone unavailable', 'Check your device and permissions.');
    }
  };

  const selectClass = 'w-full rounded-xl bg-surface-2/80 border border-line/70 px-3 py-2.5 text-sm text-content focus:outline-none focus:border-accent/70';

  const slider = (label: string, value: number, onChange: (n: number) => void, max = 100) => (
    <div className="rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-content">{label}</span>
        <span className="tabular-nums text-xs text-muted">{value}%</span>
      </div>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Section title="Voice & Audio" description="Choose your microphone and speakers, then set your levels.">
        <div className="space-y-3">
          {needsPermission && (
            <button onClick={async () => { await ensureMicPermission(); await refresh(); }} className="btn-soft w-full text-sm">
              Allow microphone access to see device names
            </button>
          )}

          <div className="rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-content">
              <Mic size={15} /> Input Device
            </label>
            <select
              className={selectClass}
              value={settings.inputDeviceId}
              onChange={(e) => { updateSettings({ inputDeviceId: e.target.value }); void voice.setInputDevice(e.target.value); }}
            >
              <option value="">Default</option>
              {inputs.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
            </select>
          </div>

          <div className="rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-content">
              <Headphones size={15} /> Output Device
            </label>
            {canSelectOutput ? (
              <select
                className={selectClass}
                value={settings.outputDeviceId}
                onChange={(e) => { updateSettings({ outputDeviceId: e.target.value }); void voice.setOutputDevice(e.target.value); }}
              >
                <option value="">Default</option>
                {outputs.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Speaker ${i + 1}`}</option>)}
              </select>
            ) : (
              <p className="text-xs text-muted">Your browser plays audio through the system default output device.</p>
            )}
          </div>

          {slider('Input volume', settings.inputVolume, (n) => { updateSettings({ inputVolume: n }); voice.setInputVolume(n); }, 200)}
          {slider('Output volume', settings.outputVolume, (n) => { updateSettings({ outputVolume: n }); voice.setOutputVolume(n); })}

          <div className="rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-content"><Volume2 size={15} /> Mic Test</span>
              <button
                onClick={testing ? stopTest : startTest}
                className={cn('rounded-lg px-3 py-1 text-xs font-semibold transition', testing ? 'bg-danger/20 text-danger' : 'bg-accent text-white hover:brightness-110')}
              >
                {testing ? 'Stop' : "Let's Check"}
              </button>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%`, background: 'linear-gradient(90deg, rgb(var(--c-success)), rgb(var(--c-accent)))' }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">{testing ? 'Speak — the bar should move as it hears you.' : 'Check that your selected mic is picking up sound.'}</p>
          </div>
        </div>
      </Section>

      <Section title="Push to talk">
        <div className="space-y-2">
          <ToggleRow
            title="Enable push to talk"
            description="Only transmit while holding your keybind."
            checked={settings.pushToTalk}
            onChange={(v) => updateSettings({ pushToTalk: v })}
          />
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-content">Push to talk key</p>
              <p className="mt-0.5 text-xs text-muted">The key that opens your mic.</p>
            </div>
            <kbd className="chip bg-surface-3 text-content font-mono">{settings.pushToTalkKey}</kbd>
          </div>
        </div>
      </Section>
    </div>
  );
}

function KeybindsPanel() {
  return (
    <div className="space-y-6">
      <Section title="Keybinds" description="Handy shortcuts to move around faster.">
        <div className="space-y-2">
          {KEYBINDS.map((bind) => (
            <div
              key={bind.label}
              className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2/60 border border-line/50 px-4 py-3"
            >
              <span className="text-sm font-medium text-content">{bind.label}</span>
              <kbd className="chip bg-surface-3 text-content font-mono">{bind.keys}</kbd>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function LanguagePanel() {
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);

  return (
    <div className="space-y-6">
      <Section title="Language" description="Choose the language for the Nebula interface.">
        <Field label="Display language">
          <select
            className="input"
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>
    </div>
  );
}

function PrivacyPanel() {
  const [directMessages, setDirectMessages] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [readReceipts, setReadReceipts] = useState(false);
  const [dataUsage, setDataUsage] = useState(false);

  return (
    <div className="space-y-6">
      <Section title="Privacy & Safety" description="Decide who can reach you and what you share.">
        <div className="space-y-2">
          <ToggleRow
            title="Allow direct messages"
            description="Let server members send you DMs."
            checked={directMessages}
            onChange={setDirectMessages}
          />
          <ToggleRow
            title="Allow friend requests"
            description="Let anyone send you a friend request."
            checked={friendRequests}
            onChange={setFriendRequests}
          />
          <ToggleRow
            title="Read receipts"
            description="Show others when you've read a message."
            checked={readReceipts}
            onChange={setReadReceipts}
          />
          <ToggleRow
            title="Usage analytics"
            description="Share anonymous data to help improve Nebula."
            checked={dataUsage}
            onChange={setDataUsage}
          />
        </div>
        <p className="text-xs text-faint">
          These preferences are stored locally in this demo and are not yet synced to the server.
        </p>
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modal shell                                                                */
/* -------------------------------------------------------------------------- */

function normalizeTab(tab?: string): TabId {
  const match = TABS.find((t) => t.id === tab);
  return match ? match.id : 'account';
}

export default function SettingsModal({ onClose, tab }: { onClose: () => void; tab?: string }) {
  const [active, setActive] = useState<TabId>(() => normalizeTab(tab));
  const logout = useAuthStore((s) => s.logout);

  const panel = useMemo(() => {
    switch (active) {
      case 'account':
        return <AccountPanel />;
      case 'appearance':
        return <AppearancePanel />;
      case 'notifications':
        return <NotificationsPanel />;
      case 'voice':
        return <VoicePanel />;
      case 'keybinds':
        return <KeybindsPanel />;
      case 'language':
        return <LanguagePanel />;
      case 'privacy':
        return <PrivacyPanel />;
      default:
        return null;
    }
  }, [active]);

  function onLogout() {
    logout();
    onClose();
  }

  return (
    <Modal wide onClose={onClose} title="Settings" subtitle="Personalize your Nebula experience">
      <div className="flex min-h-[60vh] flex-col gap-6 md:flex-row">
        {/* Tab nav */}
        <nav className="flex shrink-0 flex-col gap-1 md:w-52">
          <div className="flex gap-1 overflow-x-auto no-scrollbar md:flex-col md:overflow-visible">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition md:w-full',
                    isActive
                      ? 'bg-accent/15 text-content'
                      : 'text-muted hover:bg-white/5 hover:text-content',
                  )}
                >
                  <Icon size={16} />
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-line/50 pt-2 md:mt-auto">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger/15"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </nav>

        {/* Content pane */}
        <div className="min-w-0 flex-1 md:border-l md:border-line/50 md:pl-6">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {panel}
          </motion.div>
        </div>
      </div>
    </Modal>
  );
}
