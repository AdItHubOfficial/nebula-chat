import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Search, Volume2, CornerDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PublicUser, ServerSummary, Channel } from '@shared/types';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/lib/api';
import { useServerStore } from '@/store/serverStore';
import { useModalStore } from '@/store/modalStore';
import { cn, abbreviateServer, gradientFor } from '@/lib/utils';

type ResultKind = 'server' | 'channel' | 'person';

type ServerRow = { kind: 'server'; item: ServerSummary };
type ChannelRow = { kind: 'channel'; item: Channel };
type PersonRow = { kind: 'person'; item: PublicUser };
type Row = ServerRow | ChannelRow | PersonRow;

const GROUP_LABEL: Record<ResultKind, string> = {
  server: 'Servers',
  channel: 'Channels',
  person: 'People',
};

function ServerIcon({ server, size = 32 }: { server: ServerSummary; size?: number }) {
  const [from, to] = gradientFor(server.id);
  return server.iconUrl ? (
    <img src={server.iconUrl} alt={server.name} className="rounded-lg object-cover" style={{ width: size, height: size }} draggable={false} />
  ) : (
    <div
      className="grid place-items-center rounded-lg text-xs font-bold text-white"
      style={{ width: size, height: size, backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {abbreviateServer(server.name)}
    </div>
  );
}

export default function QuickSwitcher({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const trimmed = query.trim();

  // Recent servers to suggest when the query is empty.
  const recentServers = useMemo(() => useServerStore.getState().servers.slice(0, 8), []);

  // Debounced global search (~180ms).
  useEffect(() => {
    if (!trimmed) {
      setServers([]);
      setChannels([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await api.search.global(trimmed);
        if (cancelled) return;
        setServers(res.servers);
        setChannels(res.channels);
        setPeople(res.users);
      } catch {
        if (cancelled) return;
        setServers([]);
        setChannels([]);
        setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed]);

  // Flat, ordered list of rows grouped by type: Servers, Channels, People.
  const rows = useMemo<Row[]>(() => {
    if (!trimmed) return recentServers.map((s) => ({ kind: 'server', item: s }) as Row);
    return [
      ...servers.map((s) => ({ kind: 'server', item: s }) as Row),
      ...channels.map((c) => ({ kind: 'channel', item: c }) as Row),
      ...people.map((u) => ({ kind: 'person', item: u }) as Row),
    ];
  }, [trimmed, recentServers, servers, channels, people]);

  // Keep selection in bounds whenever the result set changes.
  useEffect(() => {
    setSelectedIndex((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function activate(row: Row | undefined) {
    if (!row) return;
    if (row.kind === 'server') {
      navigate(`/channels/${row.item.id}`);
    } else if (row.kind === 'channel') {
      navigate(`/channels/${row.item.serverId}/${row.item.id}`);
    } else {
      useModalStore.getState().open('userProfile', { userId: row.item.id });
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(rows[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  // Scroll the selected row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const showHeaders = !!trimmed;
  let lastKind: ResultKind | null = null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="glass-strong relative z-10 flex max-h-[68vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-panel"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -6 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-3 border-b border-line/50 px-4 py-3">
          <Search size={18} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a server, channel, or person…"
            className="w-full bg-transparent text-base text-content outline-none placeholder:text-faint"
            aria-label="Quick switcher search"
          />
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
          {!trimmed && rows.length > 0 && <div className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-faint">Recent</div>}

          {rows.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted">
              {loading ? 'Searching…' : trimmed ? 'No matches found.' : 'Start typing to search everything.'}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map((row, index) => {
                const header = showHeaders && row.kind !== lastKind ? GROUP_LABEL[row.kind] : null;
                lastKind = row.kind;
                const selected = index === selectedIndex;
                return (
                  <div key={`${row.kind}:${row.item.id}`}>
                    {header && <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-faint">{header}</div>}
                    <button
                      type="button"
                      data-row-index={index}
                      onMouseMove={() => setSelectedIndex(index)}
                      onClick={() => activate(row)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                        selected ? 'bg-accent text-white' : 'text-content hover:bg-white/5',
                      )}
                    >
                      {row.kind === 'server' && <ServerIcon server={row.item} />}
                      {row.kind === 'channel' && (
                        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', selected ? 'bg-white/15' : 'bg-surface-3/70')}>
                          {row.item.type === 'VOICE' ? <Volume2 size={16} /> : <Hash size={16} />}
                        </div>
                      )}
                      {row.kind === 'person' && <Avatar userId={row.item.id} name={row.item.displayName} src={row.item.avatarUrl} size={32} />}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {row.kind === 'person' ? row.item.displayName : row.item.name}
                        </div>
                        <div className={cn('truncate text-xs', selected ? 'text-white/70' : 'text-faint')}>
                          {row.kind === 'server' && 'Server'}
                          {row.kind === 'channel' && (row.item.type === 'VOICE' ? 'Voice channel' : 'Text channel')}
                          {row.kind === 'person' && `@${row.item.username}`}
                        </div>
                      </div>

                      {selected && <CornerDownLeft size={15} className="shrink-0 text-white/70" />}
                    </button>
                  </div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line/50 bg-black/10 px-4 py-2 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <kbd className="chip bg-surface-3/70 px-1.5 py-0 font-mono">↑</kbd>
            <kbd className="chip bg-surface-3/70 px-1.5 py-0 font-mono">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="chip bg-surface-3/70 px-1.5 py-0 font-mono">↵</kbd>
            to open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="chip bg-surface-3/70 px-1.5 py-0 font-mono">esc</kbd>
            to close
          </span>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
