import { motion } from 'framer-motion';
import { Mic, MicOff, Headphones, PhoneOff, Volume2, Signal, Radio } from 'lucide-react';
import { useServerStore } from '@/store/serverStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import type { Channel } from '@shared/types';

export default function VoicePanel({ channel }: { channel: Channel }) {
  const participants = useServerStore((s) => s.voiceStates[channel.id]) ?? [];
  const { channelId, muted, deafened, join, leave, toggleMute, toggleDeafen, setUserVolume, getUserVolume } = useVoiceStore();
  const me = useAuthStore((s) => s.user);
  const connected = channelId === channel.id;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-base/40">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line/50 px-4">
        <Volume2 size={20} className="text-muted" />
        <h1 className="font-semibold">{channel.name}</h1>
        {participants.length > 0 && (
          <span className="ml-2 flex items-center gap-1 text-xs text-success">
            <Signal size={13} /> {participants.length} connected
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="grid h-24 w-24 place-items-center rounded-full bg-surface-2/70">
              <Radio size={40} className="text-muted" />
            </motion.div>
            <div>
              <h2 className="font-display text-xl font-bold">{channel.name}</h2>
              <p className="mt-1 text-sm text-muted">No one's here yet — be the first to hop in.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-5">
            {participants.map((p) => {
              const isSelf = p.userId === me?.id;
              return (
                <motion.div
                  key={p.userId}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn('group relative flex w-44 flex-col items-center gap-3 rounded-3xl border bg-surface-2/50 p-6 transition', p.speaking ? 'border-success shadow-[0_0_0_2px_rgb(var(--c-success)/0.5)]' : 'border-line/50')}
                >
                  <div className={cn('rounded-full transition', p.speaking && 'ring-4 ring-success/60')}>
                    <Avatar userId={p.userId} name={p.displayName} size={72} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.deafened ? <Headphones size={14} className="text-danger" /> : p.muted ? <MicOff size={14} className="text-danger" /> : null}
                    <span className="max-w-[120px] truncate font-semibold">{p.displayName}</span>
                  </div>
                  {!isSelf && (
                    <div className="flex w-full items-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <Volume2 size={14} className="text-muted" />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        defaultValue={getUserVolume(p.userId) * 100}
                        onChange={(e) => setUserVolume(p.userId, Number(e.target.value) / 100)}
                        className="flex-1"
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="glass-strong flex items-center gap-2 rounded-2xl p-2 shadow-panel">
          {connected ? (
            <>
              <Tooltip content={muted ? 'Unmute' : 'Mute'}>
                <button onClick={toggleMute} className={cn('grid h-12 w-12 place-items-center rounded-xl transition', muted ? 'bg-danger/20 text-danger' : 'bg-surface-3/70 text-content hover:bg-surface-3')}>
                  {muted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              </Tooltip>
              <Tooltip content={deafened ? 'Undeafen' : 'Deafen'}>
                <button onClick={toggleDeafen} className={cn('grid h-12 w-12 place-items-center rounded-xl transition', deafened ? 'bg-danger/20 text-danger' : 'bg-surface-3/70 text-content hover:bg-surface-3')}>
                  <Headphones size={20} />
                </button>
              </Tooltip>
              <Tooltip content="Disconnect">
                <button onClick={leave} className="grid h-12 w-12 place-items-center rounded-xl bg-danger text-white transition hover:brightness-110">
                  <PhoneOff size={20} />
                </button>
              </Tooltip>
            </>
          ) : (
            <button onClick={() => void join(channel.id)} className="btn-primary px-6 py-3 text-base">
              <Signal size={18} /> Join Voice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
