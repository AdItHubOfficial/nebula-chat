import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Headphones, Video, VideoOff, PhoneOff, MonitorUp, ScreenShare } from 'lucide-react';
import { useServerStore } from '@/store/serverStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useAuthStore } from '@/store/authStore';
import { voice } from '@/lib/voice';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import type { VoiceParticipant } from '@/types';

// Full in-call UI: a bounded video grid with always-visible controls.
export default function CallStage({ dmId }: { dmId: string }) {
  const participants = useServerStore((s) => s.voiceStates[dmId]) ?? [];
  const { muted, deafened, videoEnabled, screenSharing, tick, toggleMute, toggleDeafen, toggleCamera, toggleScreenShare, leave } = useVoiceStore();
  const me = useAuthStore((s) => s.user);
  const cols = participants.length <= 1 ? 1 : 2;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-3 flex flex-col overflow-hidden rounded-2xl border border-line/60 bg-black/50 shadow-card">
      <div
        className="grid gap-2 p-2"
        style={{ height: 'min(56vh, 520px)', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}
      >
        {participants.map((p) => (
          <Tile key={p.userId} p={p} isMe={p.userId === me?.id} mirror={p.userId === me?.id && videoEnabled && !screenSharing} tick={tick} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-line/50 bg-black/40 p-3">
        <Ctrl danger={muted} label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </Ctrl>
        <Ctrl danger={deafened} label={deafened ? 'Undeafen' : 'Deafen'} onClick={toggleDeafen}>
          <Headphones size={18} />
        </Ctrl>
        <Ctrl active={videoEnabled && !screenSharing} label={videoEnabled && !screenSharing ? 'Stop Video' : 'Start Video'} onClick={() => void toggleCamera()}>
          {videoEnabled && !screenSharing ? <Video size={18} /> : <VideoOff size={18} />}
        </Ctrl>
        <Ctrl active={screenSharing} label={screenSharing ? 'Stop Sharing' : 'Share Screen'} onClick={() => void toggleScreenShare()}>
          {screenSharing ? <ScreenShare size={18} /> : <MonitorUp size={18} />}
        </Ctrl>
        <Tooltip content="Hang up">
          <button onClick={leave} className="ml-1 grid h-11 w-14 place-items-center rounded-xl bg-danger text-white transition hover:brightness-110">
            <PhoneOff size={18} />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  );
}

function Ctrl({ children, label, onClick, active, danger }: { children: ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <Tooltip content={label}>
      <button onClick={onClick} className={cn('grid h-11 w-11 place-items-center rounded-xl transition', danger ? 'bg-danger/20 text-danger' : active ? 'bg-accent text-white' : 'bg-surface-3/70 text-content hover:bg-surface-3')}>
        {children}
      </button>
    </Tooltip>
  );
}

function Tile({ p, isMe, mirror, tick }: { p: VoiceParticipant; isMe: boolean; mirror: boolean; tick: number }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stream = isMe ? voice.getLocalVideoStream() : voice.streamForSocket(p.socketId);
    if (ref.current) ref.current.srcObject = stream && stream.getVideoTracks().length ? stream : null;
  }, [p.socketId, p.video, isMe, tick]);

  return (
    <div className={cn('relative min-h-0 overflow-hidden rounded-xl bg-black transition', p.speaking && 'ring-2 ring-success')}>
      {p.video ? (
        <video ref={ref} autoPlay playsInline muted className={cn('h-full w-full object-contain', mirror && '-scale-x-100')} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-surface-2">
          <Avatar userId={p.userId} name={p.displayName} size={72} />
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
        {p.deafened ? <Headphones size={12} className="text-danger" /> : p.muted ? <MicOff size={12} className="text-danger" /> : null}
        {p.displayName}
        {isMe ? ' (you)' : ''}
      </div>
    </div>
  );
}
