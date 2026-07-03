import { motion } from 'framer-motion';
import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Headphones } from 'lucide-react';
import { useServerStore } from '@/store/serverStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';

// Shows the state of a DM voice call: join prompt, or in-call controls.
export default function DMCallBar({ dmId }: { dmId: string }) {
  const participants = useServerStore((s) => s.voiceStates[dmId]) ?? [];
  const { channelId, muted, deafened, joinDM, leave, toggleMute, toggleDeafen } = useVoiceStore();
  const me = useAuthStore((s) => s.user);
  const inThisCall = channelId === dmId;

  if (participants.length === 0 && !inThisCall) return null;

  const others = participants.filter((p) => p.userId !== me?.id);
  const names = others.map((o) => o.displayName).join(', ');
  const label = inThisCall
    ? names
      ? `In call with ${names}`
      : 'Waiting for someone to join…'
    : `${names || 'Someone'} is in a call`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/20 text-success">
        <PhoneCall size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-success">Voice Call</div>
        <div className="truncate text-xs text-muted">{label}</div>
      </div>

      {participants.length > 0 && (
        <div className="flex -space-x-2">
          {participants.slice(0, 4).map((p) => (
            <div key={p.userId} className={cn('rounded-full ring-2 ring-surface transition', p.speaking && 'ring-success')}>
              <Avatar userId={p.userId} name={p.displayName} size={30} />
            </div>
          ))}
        </div>
      )}

      {inThisCall ? (
        <div className="flex items-center gap-1">
          <Tooltip content={muted ? 'Unmute' : 'Mute'}>
            <button onClick={toggleMute} className={cn('grid h-9 w-9 place-items-center rounded-xl transition', muted ? 'bg-danger/20 text-danger' : 'bg-surface-3/70 text-content hover:bg-surface-3')}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </Tooltip>
          <Tooltip content={deafened ? 'Undeafen' : 'Deafen'}>
            <button onClick={toggleDeafen} className={cn('grid h-9 w-9 place-items-center rounded-xl transition', deafened ? 'bg-danger/20 text-danger' : 'bg-surface-3/70 text-content hover:bg-surface-3')}>
              <Headphones size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Leave call">
            <button onClick={leave} className="grid h-9 w-9 place-items-center rounded-xl bg-danger text-white transition hover:brightness-110">
              <PhoneOff size={16} />
            </button>
          </Tooltip>
        </div>
      ) : (
        <button
          onClick={() => void joinDM(dmId)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: 'rgb(var(--c-success))' }}
        >
          <Phone size={15} /> Join Call
        </button>
      )}
    </motion.div>
  );
}
