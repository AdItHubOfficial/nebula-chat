import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pin, Search, Users, Hash, Phone, Video } from 'lucide-react';
import { useMessageStore } from '@/store/messageStore';
import { useModalStore } from '@/store/modalStore';
import { useServerStore } from '@/store/serverStore';
import { useVoiceStore } from '@/store/voiceStore';
import DMCallBar from '@/components/voice/DMCallBar';
import CallStage from '@/components/voice/CallStage';
import { subscribeChannel, unsubscribeChannel } from '@/services/realtime';
import { emit } from '@/lib/socket';
import { SocketEvents } from '@shared/events';
import { api } from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';
import { messageTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import MessageList from './MessageList';
import Composer from './Composer';
import type { Message } from '@shared/types';

interface Props {
  channelId?: string;
  dmId?: string;
  title: string;
  icon: ReactNode;
  topic?: string;
  canSend: boolean;
  canManage: boolean;
  composerPlaceholder: string;
  serverId?: string;
  membersOpen?: boolean;
  onToggleMembers?: () => void;
}

export default function ChatArea({ channelId, dmId, title, icon, topic, canSend, canManage, composerPlaceholder, serverId, membersOpen, onToggleMembers }: Props) {
  const key = channelId ?? dmId ?? '';
  const open = useModalStore((s) => s.open);
  const ownerId = useServerStore((s) => (serverId ? s.details[serverId]?.ownerId : undefined));
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const inThisCall = !!dmId && voiceChannelId === dmId;
  const [pinsOpen, setPinsOpen] = useState(false);

  useEffect(() => {
    useMessageStore.getState().setActive(key);
    if (channelId) subscribeChannel(channelId);
    const ack = () => emit(SocketEvents.READ_ACK, channelId ? { channelId } : { dmChannelId: dmId });
    ack();
    window.addEventListener('focus', ack);
    return () => {
      window.removeEventListener('focus', ack);
      if (channelId) unsubscribeChannel(channelId);
      useMessageStore.getState().setActive(null);
    };
  }, [key, channelId, dmId]);

  const intro = (
    <div className="px-4 pb-2 pt-6">
      <div className="mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-surface-3/70 text-3xl">{icon}</div>
      <h2 className="font-display text-2xl font-bold">Welcome to {title}</h2>
      <p className="mt-1 text-sm text-muted">{topic || `This is the beginning of ${title}.`}</p>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-base/40">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line/50 px-4 shadow-sm">
        <span className="text-muted">{icon}</span>
        <h1 className="truncate font-semibold text-content">{title}</h1>
        {topic && (
          <>
            <span className="mx-1 h-5 w-px bg-line/60" />
            <p className="hidden truncate text-sm text-muted md:block">{topic}</p>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {channelId && (
            <div className="relative">
              <HeaderBtn label="Pinned Messages" active={pinsOpen} onClick={() => setPinsOpen((s) => !s)}>
                <Pin size={19} />
              </HeaderBtn>
              <AnimatePresence>{pinsOpen && <PinnedPopover channelId={channelId} onClose={() => setPinsOpen(false)} />}</AnimatePresence>
            </div>
          )}
          {dmId && (
            <>
              <HeaderBtn label="Start Voice Call" onClick={() => void useVoiceStore.getState().joinDM(dmId)}>
                <Phone size={18} />
              </HeaderBtn>
              <HeaderBtn
                label="Start Video Call"
                onClick={async () => {
                  await useVoiceStore.getState().joinDM(dmId);
                  if (!useVoiceStore.getState().videoEnabled) await useVoiceStore.getState().toggleCamera();
                }}
              >
                <Video size={18} />
              </HeaderBtn>
            </>
          )}
          <HeaderBtn label="Search" onClick={() => open('search', serverId ? { serverId } : undefined)}>
            <Search size={19} />
          </HeaderBtn>
          {onToggleMembers && (
            <HeaderBtn label={membersOpen ? 'Hide Members' : 'Show Members'} active={membersOpen} onClick={onToggleMembers}>
              <Users size={19} />
            </HeaderBtn>
          )}
        </div>
      </header>

      {dmId && (inThisCall ? <CallStage dmId={dmId} /> : <DMCallBar dmId={dmId} />)}
      <MessageList channelId={channelId} dmId={dmId} canManage={canManage} ownerId={ownerId} header={intro} />
      <Composer channelId={channelId} dmId={dmId} placeholder={composerPlaceholder} canSend={canSend} />
    </div>
  );
}

function HeaderBtn({ children, label, onClick, active }: { children: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <Tooltip content={label}>
      <button onClick={onClick} className={cn('grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10', active ? 'text-content' : 'text-muted hover:text-content')}>
        {children}
      </button>
    </Tooltip>
  );
}

function PinnedPopover({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const [pins, setPins] = useState<Message[] | null>(null);

  useEffect(() => {
    api.channels.pins(channelId).then((r) => setPins(r.items)).catch(() => setPins([]));
  }, [channelId]);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        className="glass-strong absolute right-0 top-11 z-40 max-h-96 w-80 overflow-y-auto scrollbar-thin rounded-2xl shadow-panel"
      >
        <div className="sticky top-0 border-b border-line/50 bg-surface-2/80 px-4 py-2.5 text-sm font-bold backdrop-blur">Pinned Messages</div>
        {pins === null ? (
          <div className="p-6 text-center text-sm text-muted">Loading…</div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted">
            <Hash size={28} className="text-faint" />
            No pinned messages yet.
          </div>
        ) : (
          <div className="divide-y divide-line/40">
            {pins.map((m) => (
              <div key={m.id} className="flex gap-2.5 p-3 hover:bg-white/5">
                <Avatar userId={m.authorId} name={m.author.displayName} src={m.author.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{m.author.displayName}</span>
                    <span className="text-[10px] text-faint">{messageTime(m.createdAt)}</span>
                  </div>
                  <div className="prose-chat text-sm text-muted" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}
