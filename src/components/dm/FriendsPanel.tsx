import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  MessageSquare,
  MoreVertical,
  Check,
  X,
  Ban,
  ShieldOff,
  UserMinus,
  Search,
} from 'lucide-react';
import type { FriendshipDTO } from '@shared/types';
import { Avatar } from '@/components/ui/Avatar';
import { useFriendStore } from '@/store/friendStore';
import { useDMStore } from '@/store/dmStore';
import { useModalStore } from '@/store/modalStore';
import { toast } from '@/store/toastStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

const TABS: { key: Tab; label: string }[] = [
  { key: 'online', label: 'Online' },
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'blocked', label: 'Blocked' },
];

export default function FriendsPanel() {
  const navigate = useNavigate();
  const friends = useFriendStore((s) => s.friends);
  const loading = useFriendStore((s) => s.loading);
  const [tab, setTab] = useState<Tab>('online');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void useFriendStore.getState().load();
  }, []);

  const reload = () => useFriendStore.getState().load();

  const accepted = useMemo(() => friends.filter((f) => f.status === 'ACCEPTED'), [friends]);
  const online = useMemo(() => accepted.filter((f) => f.user.online === true), [accepted]);
  const pending = useMemo(() => friends.filter((f) => f.status === 'PENDING'), [friends]);
  const blocked = useMemo(() => friends.filter((f) => f.status === 'BLOCKED'), [friends]);
  const pendingCount = pending.length;

  const openProfile = (userId: string) => useModalStore.getState().open('userProfile', { userId });

  const openMessage = async (userId: string) => {
    try {
      const dm = await useDMStore.getState().openDM(userId);
      navigate(`/channels/@me/${dm.id}`);
    } catch (err) {
      toast.error('Could not open DM', err instanceof Error ? err.message : undefined);
    }
  };

  const filterByQuery = (list: FriendshipDTO[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (f) => f.user.displayName.toLowerCase().includes(q) || f.user.username.toLowerCase().includes(q),
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      {/* Header bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/60 px-4">
        <div className="flex items-center gap-2 pr-3 text-content">
          <Users size={20} className="text-muted" />
          <span className="font-semibold">Friends</span>
        </div>
        <div className="h-6 w-px bg-line/60" />
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-surface-3 text-content' : 'text-muted hover:bg-white/5 hover:text-content',
              )}
            >
              {t.label}
              {t.key === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          onClick={() => setTab('add')}
          className={cn(
            'ml-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
            tab === 'add'
              ? 'bg-surface-3 text-accent'
              : 'bg-accent/15 text-accent hover:bg-accent/25',
          )}
        >
          Add Friend
        </button>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'add' ? (
          <AddFriendTab onSent={reload} />
        ) : (
          <div className="px-4 py-4">
            {/* Search box (not for blocked emphasis, but useful across lists) */}
            {tab !== 'blocked' && (accepted.length > 0 || tab === 'online') && (
              <div className="relative mb-4">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  className="input pl-9"
                  placeholder="Search friends"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}

            {tab === 'online' && (
              <FriendList
                title={`Online — ${filterByQuery(online).length}`}
                rows={filterByQuery(online)}
                emptyIcon={<Users size={40} />}
                emptyText="It's quiet out here."
                emptySub="When your friends are online, you'll see them here."
                renderActions={(f) => (
                  <RowActions
                    onMessage={() => openMessage(f.user.id)}
                    onRemove={async () => {
                      await api.friends.remove(f.id);
                      toast.success('Friend removed');
                      reload();
                    }}
                    onBlock={async () => {
                      await api.friends.block(f.user.id);
                      toast.success('User blocked');
                      reload();
                    }}
                  />
                )}
                onOpen={openProfile}
              />
            )}

            {tab === 'all' && (
              <FriendList
                title={`All Friends — ${filterByQuery(accepted).length}`}
                rows={filterByQuery(accepted)}
                emptyIcon={<Users size={40} />}
                emptyText="No friends yet."
                emptySub="Add a friend to start chatting."
                renderActions={(f) => (
                  <RowActions
                    onMessage={() => openMessage(f.user.id)}
                    onRemove={async () => {
                      await api.friends.remove(f.id);
                      toast.success('Friend removed');
                      reload();
                    }}
                    onBlock={async () => {
                      await api.friends.block(f.user.id);
                      toast.success('User blocked');
                      reload();
                    }}
                  />
                )}
                onOpen={openProfile}
              />
            )}

            {tab === 'pending' && (
              <FriendList
                title={`Pending — ${pending.length}`}
                rows={pending}
                emptyIcon={<UserPlus size={40} />}
                emptyText="No pending requests."
                emptySub="Incoming and outgoing friend requests appear here."
                renderActions={(f) =>
                  f.direction === 'incoming' ? (
                    <div className="flex items-center gap-2">
                      <IconAction
                        title="Accept"
                        variant="success"
                        onClick={async () => {
                          await api.friends.accept(f.id);
                          toast.success('Friend request accepted');
                          reload();
                        }}
                      >
                        <Check size={18} />
                      </IconAction>
                      <IconAction
                        title="Decline"
                        variant="danger"
                        onClick={async () => {
                          await api.friends.decline(f.id);
                          toast.info('Request declined');
                          reload();
                        }}
                      >
                        <X size={18} />
                      </IconAction>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-faint">Outgoing</span>
                      <IconAction
                        title="Cancel request"
                        variant="danger"
                        onClick={async () => {
                          await api.friends.decline(f.id);
                          toast.info('Request cancelled');
                          reload();
                        }}
                      >
                        <X size={18} />
                      </IconAction>
                    </div>
                  )
                }
                onOpen={openProfile}
              />
            )}

            {tab === 'blocked' && (
              <FriendList
                title={`Blocked — ${blocked.length}`}
                rows={blocked}
                emptyIcon={<Ban size={40} />}
                emptyText="You haven't blocked anyone."
                emptySub="Blocked users can't message you or add you as a friend."
                renderActions={(f) => (
                  <button
                    className="btn-soft px-3 py-1.5 text-sm"
                    onClick={async () => {
                      await api.friends.unblock(f.user.id);
                      toast.success('User unblocked');
                      reload();
                    }}
                  >
                    <ShieldOff size={16} />
                    Unblock
                  </button>
                )}
                onOpen={openProfile}
              />
            )}
          </div>
        )}

        {loading && friends.length === 0 && tab !== 'add' && (
          <div className="px-4 pb-6 text-sm text-faint">Loading…</div>
        )}
      </div>
    </div>
  );
}

/* ---------- Add Friend tab ---------- */

function AddFriendTab({ onSent }: { onSent: () => void }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = username.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await api.friends.request(value);
      toast.success('Friend request sent', `Your request to ${value} is on its way.`);
      setUsername('');
      onSent();
    } catch (err) {
      toast.error('Could not send request', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-5">
      <h2 className="text-base font-semibold text-content">Add Friend</h2>
      <p className="mt-1 text-sm text-muted">You can add friends with their username.</p>
      <form onSubmit={submit} className="mt-4">
        <div className="card flex items-center gap-2 rounded-2xl p-2 focus-within:border-accent/70">
          <input
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-content placeholder:text-faint focus:outline-none"
            placeholder="Enter a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary shrink-0" disabled={busy || !username.trim()}>
            <UserPlus size={16} />
            Send Friend Request
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Shared list + row ---------- */

interface FriendListProps {
  title: string;
  rows: FriendshipDTO[];
  emptyIcon: React.ReactNode;
  emptyText: string;
  emptySub: string;
  renderActions: (f: FriendshipDTO) => React.ReactNode;
  onOpen: (userId: string) => void;
}

function FriendList({ title, rows, emptyIcon, emptyText, emptySub, renderActions, onOpen }: FriendListProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="text-faint">{emptyIcon}</div>
        <p className="text-sm font-medium text-muted">{emptyText}</p>
        <p className="max-w-xs text-xs text-faint">{emptySub}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-faint">{title}</h3>
      <ul className="divide-y divide-line/40">
        {rows.map((f) => (
          <li
            key={f.id}
            className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/5"
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => onOpen(f.user.id)}
            >
              <Avatar
                userId={f.user.id}
                name={f.user.displayName}
                src={f.user.avatarUrl}
                presence={f.user.presence}
                showPresence
                size={40}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-content">{f.user.displayName}</span>
                  <span className="truncate text-sm text-faint">@{f.user.username}</span>
                </div>
                <div className="truncate text-xs text-muted">
                  {f.user.customStatus || (f.user.online ? 'Online' : 'Offline')}
                </div>
              </div>
            </button>
            <div className="shrink-0 opacity-90">{renderActions(f)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Action controls ---------- */

function RowActions({
  onMessage,
  onRemove,
  onBlock,
}: {
  onMessage: () => void;
  onRemove: () => void | Promise<void>;
  onBlock: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <IconAction title="Message" variant="soft" onClick={onMessage}>
        <MessageSquare size={18} />
      </IconAction>
      <div className="relative">
        <IconAction title="More" variant="soft" onClick={() => setOpen((v) => !v)}>
          <MoreVertical size={18} />
        </IconAction>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="glass-strong absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl py-1 shadow-card">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content hover:bg-white/5"
                onClick={() => {
                  setOpen(false);
                  void onRemove();
                }}
              >
                <UserMinus size={16} className="text-muted" />
                Remove Friend
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
                onClick={() => {
                  setOpen(false);
                  void onBlock();
                }}
              >
                <Ban size={16} />
                Block
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IconAction({
  children,
  title,
  onClick,
  variant = 'soft',
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  variant?: 'soft' | 'success' | 'danger';
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full bg-surface-3/70 transition-colors',
        variant === 'soft' && 'text-muted hover:bg-surface-3 hover:text-content',
        variant === 'success' && 'text-success hover:bg-success/15',
        variant === 'danger' && 'text-danger hover:bg-danger/15',
      )}
    >
      {children}
    </button>
  );
}
