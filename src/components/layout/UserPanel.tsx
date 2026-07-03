import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, Settings, PhoneOff, Signal } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useServerStore } from '@/store/serverStore';
import { useModalStore } from '@/store/modalStore';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import AccountPopover from './AccountPopover';

export default function UserPanel() {
  const user = useAuthStore((s) => s.user);
  const { channelId, muted, deafened, toggleMute, toggleDeafen, leave } = useVoiceStore();
  const voiceChannel = useServerStore((s) => (channelId ? s.getChannel(channelId) : undefined));
  const open = useModalStore((s) => s.open);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="mt-auto flex flex-col">
      {channelId && (
        <div className="mx-2 mb-1 flex items-center justify-between rounded-xl bg-success/10 px-2.5 py-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-success">
              <Signal size={13} /> {voiceChannel ? 'Voice Connected' : 'In a Call'}
            </div>
            <div className="truncate text-[11px] text-muted">{voiceChannel?.name ?? 'Voice call'}</div>
          </div>
          <Tooltip content="Hang up">
            <button onClick={leave} className="rounded-lg p-1.5 text-muted transition hover:bg-danger/20 hover:text-danger">
              <PhoneOff size={16} />
            </button>
          </Tooltip>
        </div>
      )}
      <div className="relative flex items-center gap-1 bg-black/25 px-1.5 py-1.5">
        <AnimatePresence>{menuOpen && <AccountPopover onClose={() => setMenuOpen(false)} />}</AnimatePresence>

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/5', menuOpen && 'bg-white/5')}
        >
          <Avatar userId={user.id} name={user.displayName} src={user.avatarUrl} size={32} presence={user.presence} showPresence />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-content">{user.displayName}</div>
            <div className="truncate text-[11px] text-muted">{user.customStatus || `@${user.username}`}</div>
          </div>
        </button>
        <div className="flex items-center">
          <Tooltip content={muted ? 'Unmute' : 'Mute'}>
            <button onClick={toggleMute} className={cn('rounded-lg p-2 transition hover:bg-white/5', muted ? 'text-danger' : 'text-muted hover:text-content')}>
              {muted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          </Tooltip>
          <Tooltip content={deafened ? 'Undeafen' : 'Deafen'}>
            <button onClick={toggleDeafen} className={cn('rounded-lg p-2 transition hover:bg-white/5', deafened ? 'text-danger' : 'text-muted hover:text-content')}>
              <Headphones size={17} />
            </button>
          </Tooltip>
          <Tooltip content="User Settings">
            <button onClick={() => open('settings')} className="group rounded-lg p-2 text-muted transition hover:bg-white/5 hover:text-content">
              <Settings size={17} className="transition-transform group-hover:rotate-45" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
