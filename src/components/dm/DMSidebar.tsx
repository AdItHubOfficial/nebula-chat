import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, Search, UsersRound, Plus } from 'lucide-react';
import type { DMChannelDTO } from '@shared/types';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import { useDMStore } from '@/store/dmStore';
import { useFriendStore } from '@/store/friendStore';
import { useMessageStore } from '@/store/messageStore';
import { useModalStore } from '@/store/modalStore';
import { cn } from '@/lib/utils';
import UserPanel from '@/components/layout/UserPanel';

export default function DMSidebar() {
  const dms = useDMStore((s) => s.dms);
  const unread = useMessageStore((s) => s.unread);
  const pendingCount = useFriendStore((s) => s.pendingIncomingCount());

  useEffect(() => {
    void useDMStore.getState().loadDMs();
  }, []);

  return (
    <aside className="flex h-full w-full shrink-0 flex-col bg-surface">
      {/* Search / quick switcher */}
      <div className="p-2.5">
        <button
          onClick={() => useModalStore.getState().open('quickSwitcher')}
          className="flex w-full items-center gap-2 rounded-lg bg-surface-2/80 px-2.5 py-1.5 text-sm text-faint transition-colors hover:bg-surface-2"
        >
          <Search size={14} />
          <span>Find or start a conversation</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {/* Friends home */}
        <NavLink
          to="/channels/@me"
          end
          className={({ isActive }) =>
            cn(
              'group relative mb-1 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-surface-3 text-content' : 'text-muted hover:bg-white/5 hover:text-content',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
              )}
              <Users size={20} className="shrink-0" />
              <span className="flex-1">Friends</span>
              {pendingCount > 0 && (
                <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </>
          )}
        </NavLink>

        {/* Section label */}
        <div className="group mb-1 mt-4 flex items-center justify-between px-2.5">
          <span className="text-[0.68rem] font-bold uppercase tracking-wider text-faint">Direct Messages</span>
          <Tooltip content="Create Group Chat">
            <button onClick={() => useModalStore.getState().open('createGroup')} className="text-faint transition hover:text-content" aria-label="Create Group Chat">
              <Plus size={15} />
            </button>
          </Tooltip>
        </div>

        {dms.length === 0 ? (
          <p className="px-2.5 py-4 text-xs text-faint">No conversations yet. Start one from a friend's profile.</p>
        ) : (
          <ul className="space-y-0.5">
            {dms.map((dm) => (
              <DMRow key={dm.id} dm={dm} unread={unread[dm.id] ?? 0} />
            ))}
          </ul>
        )}
      </div>

      <UserPanel />
    </aside>
  );
}

function dmDisplay(dm: DMChannelDTO): { name: string; isGroup: boolean; user?: DMChannelDTO['participants'][number] } {
  if (dm.isGroup) {
    const name =
      dm.name?.trim() ||
      dm.participants.map((p) => p.displayName).join(', ') ||
      'Group';
    return { name, isGroup: true };
  }
  const other = dm.participants[0];
  return { name: other?.displayName ?? 'Unknown', isGroup: false, user: other };
}

function DMRow({ dm, unread }: { dm: DMChannelDTO; unread: number }) {
  const { name, isGroup, user } = dmDisplay(dm);
  const preview = dm.lastMessage?.content?.trim();

  return (
    <li>
      <NavLink
        to={`/channels/@me/${dm.id}`}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-lg px-2 py-2 transition-colors',
            isActive ? 'bg-surface-3 text-content' : 'text-muted hover:bg-white/5 hover:text-content',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
            )}

            {isGroup || !user ? (
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-muted">
                <UsersRound size={18} />
              </div>
            ) : (
              <Avatar
                userId={user.id}
                name={user.displayName}
                src={user.avatarUrl}
                presence={user.presence}
                showPresence
                size={36}
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('truncate text-sm', unread > 0 ? 'font-semibold text-content' : 'font-medium')}>
                  {name}
                </span>
              </div>
              {preview ? (
                <p className="truncate text-xs text-faint">{preview}</p>
              ) : (
                <p className="truncate text-xs text-faint">
                  {isGroup ? `${dm.participants.length} members` : 'No messages yet'}
                </p>
              )}
            </div>

            {unread > 0 && (
              <span className="ml-1 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-white tabular-nums">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}
