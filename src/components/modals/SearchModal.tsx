import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Paperclip, MessageSquare, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Message } from '@shared/types';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/lib/api';
import { useServerStore } from '@/store/serverStore';
import { renderMarkdown } from '@/lib/markdown';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type SearchResult = Message & { channelName: string | null };

export default function SearchModal({ onClose, serverId }: { onClose: () => void; serverId?: string }) {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [hasAttachment, setHasAttachment] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const trimmed = query.trim();

  // Debounced message search (~200ms). Requires a query.
  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { items } = await api.search.messages({ q: trimmed, serverId, hasAttachment: hasAttachment || undefined });
        if (cancelled) return;
        setResults(items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, serverId, hasAttachment]);

  function openResult(result: SearchResult) {
    if (!result.channelId) return;
    const sid = useServerStore.getState().getServerIdOfChannel(result.channelId) ?? serverId;
    if (!sid) return;
    navigate(`/channels/${sid}/${result.channelId}`);
    onClose();
  }

  const rendered = useMemo(
    () => results.map((r) => ({ result: r, html: renderMarkdown(r.content) })),
    [results],
  );

  return (
    <Modal onClose={onClose} wide title="Search Messages" subtitle={serverId ? 'Searching this server' : 'Searching everywhere'}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages…"
              className="input pl-9"
              aria-label="Search messages"
            />
          </div>
          <button
            type="button"
            onClick={() => setHasAttachment((v) => !v)}
            aria-pressed={hasAttachment}
            className={cn(
              'btn shrink-0 gap-2 whitespace-nowrap border',
              hasAttachment ? 'btn-primary border-transparent' : 'btn-soft border-line/70',
            )}
          >
            <Paperclip size={15} />
            Has attachment
          </button>
        </div>

        <div className="min-h-[240px]">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-muted">Searching…</div>
          )}

          {!loading && !trimmed && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <MessageSquare size={34} className="text-faint" />
              <p className="text-sm text-muted">Type a query to search through messages.</p>
              <p className="text-xs text-faint">Toggle “Has attachment” to only find messages with files.</p>
            </div>
          )}

          {!loading && trimmed && searched && rendered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <SearchX size={34} className="text-faint" />
              <p className="text-sm text-muted">No messages matched “{trimmed}”.</p>
              <p className="text-xs text-faint">Try different keywords or clearing the attachment filter.</p>
            </div>
          )}

          {!loading && rendered.length > 0 && (
            <AnimatePresence initial={false}>
              <div className="flex flex-col gap-2">
                {rendered.map(({ result, html }, index) => (
                  <motion.button
                    key={result.id}
                    type="button"
                    onClick={() => openResult(result)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, delay: Math.min(index * 0.02, 0.16) }}
                    className="card group w-full px-4 py-3 text-left transition-colors hover:border-accent/50 hover:bg-surface-2/70"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar userId={result.author.id} name={result.author.displayName} src={result.author.avatarUrl} size={22} />
                      <span className="truncate text-sm font-semibold text-content">{result.author.displayName}</span>
                      {result.channelName && (
                        <span className="chip bg-surface-3/70 text-faint">#{result.channelName}</span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-faint">{relativeTime(result.createdAt)}</span>
                    </div>
                    <div
                      className="prose-chat mt-1.5 max-h-24 overflow-hidden text-sm text-muted"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                    {result.attachments.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-faint">
                        <Paperclip size={12} />
                        {result.attachments.length} attachment{result.attachments.length === 1 ? '' : 's'}
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </Modal>
  );
}
