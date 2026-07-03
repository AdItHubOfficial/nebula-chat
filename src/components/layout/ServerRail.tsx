import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Compass, Sparkles, Settings, LogOut, UserPlus, Trash2 } from 'lucide-react';
import { useServerStore } from '@/store/serverStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { useModalStore } from '@/store/modalStore';
import { useActiveIds } from '@/hooks/useActiveIds';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { abbreviateServer, cn } from '@/lib/utils';
import Tooltip from '@/components/ui/Tooltip';
import type { ServerSummary } from '@shared/types';

export default function ServerRail() {
  const navigate = useNavigate();
  const servers = useServerStore((s) => s.servers);
  const details = useServerStore((s) => s.details);
  const unread = useMessageStore((s) => s.unread);
  const mentions = useMessageStore((s) => s.mentions);
  const { serverId: activeServerId, isDM } = useActiveIds();
  const open = useModalStore((s) => s.open);
  const openContextMenu = useModalStore((s) => s.openContextMenu);
  const me = useAuthStore((s) => s.user);

  // Aggregate unread + mentions per server from channel-level counters.
  const perServer = useMemo(() => {
    const map: Record<string, { unread: number; mentions: number }> = {};
    for (const detail of Object.values(details)) {
      let u = 0;
      let m = 0;
      for (const ch of detail.channels) {
        u += unread[ch.id] ?? 0;
        m += mentions[ch.id] ?? 0;
      }
      map[detail.id] = { unread: u, mentions: m };
    }
    return map;
  }, [details, unread, mentions]);

  const dmUnread = useMemo(() => {
    let total = 0;
    for (const [key, count] of Object.entries(unread)) {
      if (!details && !servers) break;
      // channel ids belong to servers; anything not a channel we treat as dm
      const isChannel = Object.values(details).some((d) => d.channels.some((c) => c.id === key));
      if (!isChannel) total += count;
    }
    return total;
  }, [unread, details, servers]);

  function serverMenu(e: React.MouseEvent, server: ServerSummary) {
    e.preventDefault();
    const isOwner = server.ownerId === me?.id;
    openContextMenu(e.clientX, e.clientY, [
      { label: 'Invite People', icon: <UserPlus size={15} />, onClick: () => open('invite', { serverId: server.id }) },
      { label: 'Server Settings', icon: <Settings size={15} />, onClick: () => open('serverSettings', { serverId: server.id }) },
      { separator: true },
      isOwner
        ? { label: 'Delete Server', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteServer(server) }
        : { label: 'Leave Server', icon: <LogOut size={15} />, danger: true, onClick: () => leaveServer(server) },
    ]);
  }

  async function leaveServer(server: ServerSummary) {
    try {
      await api.servers.leave(server.id);
      useServerStore.getState().removeServer(server.id);
      toast.info('Left server', server.name);
      if (activeServerId === server.id) navigate('/channels/@me');
    } catch (err) {
      toast.error('Could not leave', (err as Error).message);
    }
  }

  async function deleteServer(server: ServerSummary) {
    if (!confirm(`Delete "${server.name}"? This cannot be undone.`)) return;
    try {
      await api.servers.remove(server.id);
      useServerStore.getState().removeServer(server.id);
      toast.info('Server deleted', server.name);
      if (activeServerId === server.id) navigate('/channels/@me');
    } catch (err) {
      toast.error('Could not delete', (err as Error).message);
    }
  }

  return (
    <nav className="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto no-scrollbar bg-black/30 py-3">
      <RailButton
        active={isDM}
        onClick={() => navigate('/channels/@me')}
        tooltip="Direct Messages"
        badge={dmUnread}
      >
        <div className="grid h-full w-full place-items-center rounded-[inherit]" style={{ background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))' }}>
          <Sparkles size={22} className="text-white" />
        </div>
      </RailButton>

      <div className="my-1 h-0.5 w-8 rounded-full bg-line/70" />

      {servers.map((server) => {
        const stats = perServer[server.id] ?? { unread: 0, mentions: 0 };
        return (
          <RailButton
            key={server.id}
            active={activeServerId === server.id}
            onClick={() => navigate(`/channels/${server.id}`)}
            onContextMenu={(e) => serverMenu(e, server)}
            tooltip={server.name}
            unread={stats.unread > 0}
            badge={stats.mentions}
          >
            {server.iconUrl ? (
              <img src={server.iconUrl} alt={server.name} className="h-full w-full rounded-[inherit] object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-[inherit] font-display text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${server.bannerColor}, rgb(var(--c-accent-2)))` }}>
                {abbreviateServer(server.name)}
              </div>
            )}
          </RailButton>
        );
      })}

      <RailButton onClick={() => open('createServer')} tooltip="Create a Server" plain>
        <div className="grid h-full w-full place-items-center rounded-[inherit] bg-surface-2 text-success transition-colors group-hover:bg-success group-hover:text-white">
          <Plus size={22} />
        </div>
      </RailButton>
      <RailButton onClick={() => open('joinServer')} tooltip="Join a Server" plain>
        <div className="grid h-full w-full place-items-center rounded-[inherit] bg-surface-2 text-success transition-colors group-hover:bg-success group-hover:text-white">
          <Compass size={20} />
        </div>
      </RailButton>
    </nav>
  );
}

interface RailButtonProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  tooltip: string;
  unread?: boolean;
  badge?: number;
  plain?: boolean;
}

function RailButton({ children, active, onClick, onContextMenu, tooltip, unread, badge, plain }: RailButtonProps) {
  return (
    <div className="group relative flex w-full items-center justify-center">
      {/* Active / unread pill indicator */}
      <motion.span
        className="absolute left-0 w-1 rounded-r-full bg-white"
        initial={false}
        animate={{ height: active ? 32 : unread ? 8 : 0, opacity: active || unread ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
      <Tooltip content={tooltip} side="right">
        <motion.button
          onClick={onClick}
          onContextMenu={onContextMenu}
          whileTap={{ scale: 0.9 }}
          className={cn(
            'relative h-12 w-12 overflow-hidden transition-[border-radius] duration-200',
            active ? 'rounded-2xl' : 'rounded-[24px] group-hover:rounded-2xl',
            !plain && (active ? 'shadow-glow' : ''),
          )}
        >
          {children}
        </motion.button>
      </Tooltip>
      {badge && badge > 0 ? (
        <span className="absolute -bottom-0.5 right-2 grid min-w-[18px] place-items-center rounded-full border-2 border-black/30 bg-danger px-1 text-[10px] font-bold text-white tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </div>
  );
}
