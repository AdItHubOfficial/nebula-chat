import { useEffect, useLayoutEffect, useRef, useState, useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { dateSeparator, sameDay, shouldGroup } from '@/lib/time';
import { MessageItem } from './MessageItem';
import { cn } from '@/lib/utils';

interface Props {
  channelId?: string;
  dmId?: string;
  canManage: boolean;
  ownerId?: string;
  header?: React.ReactNode;
}

export default function MessageList({ channelId, dmId, canManage, ownerId, header }: Props) {
  const key = channelId ?? dmId ?? '';
  const convo = useMessageStore((s) => s.convos[key]);
  const typing = useMessageStore((s) => s.typing[key]);
  const me = useAuthStore((s) => s.user);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const prevHeight = useRef(0);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const messages = convo?.messages ?? [];

  // Initial load when a conversation is first opened.
  useEffect(() => {
    if (convo?.loadedOnce) return;
    let cancelled = false;
    (async () => {
      useMessageStore.getState().setConvo(key, { loading: true });
      try {
        const page = channelId ? await api.messages.channel(channelId) : await api.messages.dm(dmId!);
        if (!cancelled) {
          useMessageStore.getState().setInitial(key, page.items, page.hasMore);
          requestAnimationFrame(() => scrollToBottom('auto'));
        }
      } catch {
        if (!cancelled) useMessageStore.getState().setConvo(key, { loading: false, loadedOnce: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-scroll to bottom on new messages if the user is already near the bottom.
  useEffect(() => {
    if (nearBottom.current) scrollToBottom('smooth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Preserve scroll position after prepending older messages.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && prevHeight.current) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = 0;
    }
  });

  function scrollToBottom(behavior: ScrollBehavior) {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }

  async function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (el.scrollTop < 120 && convo?.hasMore && !loadingOlder && messages.length) {
      setLoadingOlder(true);
      prevHeight.current = el.scrollHeight;
      try {
        const cursor = messages[0].id;
        const page = channelId ? await api.messages.channel(channelId, cursor) : await api.messages.dm(dmId!, cursor);
        useMessageStore.getState().prependOlder(key, page.items, page.hasMore);
      } finally {
        setLoadingOlder(false);
      }
    }
  }

  const typers = useMemo(() => {
    if (!typing) return [];
    const now = Date.now();
    return Object.entries(typing)
      .filter(([uid, t]) => t.expires > now && uid !== me?.id)
      .map(([, t]) => t.displayName);
  }, [typing, me?.id]);

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
      {loadingOlder && <div className="py-3 text-center text-xs text-muted">Loading earlier messages…</div>}

      {!convo?.hasMore && convo?.loadedOnce && header}

      {!convo?.loadedOnce && <MessageSkeleton />}

      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showSeparator = !prev || !sameDay(prev.createdAt, m.createdAt);
        const grouped = !showSeparator && !!prev && !m.replyTo && shouldGroup(prev.createdAt, m.createdAt, prev.authorId === m.authorId);
        return (
          <Fragment key={m.id}>
            {showSeparator && (
              <div className="sticky top-0 z-[1] my-2 flex items-center gap-3 px-4">
                <div className="h-px flex-1 bg-line/50" />
                <span className="rounded-full bg-surface-2/80 px-2.5 py-0.5 text-[11px] font-semibold text-muted backdrop-blur">{dateSeparator(m.createdAt)}</span>
                <div className="h-px flex-1 bg-line/50" />
              </div>
            )}
            <MessageItem message={m} grouped={grouped} convoKey={key} canManage={canManage} ownerId={ownerId} />
          </Fragment>
        );
      })}

      <div className="h-4" />
      {typers.length > 0 && <TypingIndicator names={typers} />}
    </div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  const label = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : `${names.length} people are typing`;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 pb-1 text-sm text-muted">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
      <span className="font-medium">{label}…</span>
    </motion.div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-32 rounded" />
            <div className={cn('skeleton h-3 rounded')} style={{ width: `${40 + ((i * 17) % 50)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
