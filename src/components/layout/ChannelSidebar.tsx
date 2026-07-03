import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Volume2, Megaphone, ChevronDown, ChevronRight, Plus, Settings, UserPlus, Lock, Mic, MicOff, Headphones } from 'lucide-react';
import { useServerStore } from '@/store/serverStore';
import { useMessageStore } from '@/store/messageStore';
import { useModalStore } from '@/store/modalStore';
import { useVoiceStore } from '@/store/voiceStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useActiveIds } from '@/hooks/useActiveIds';
import { Permission } from '@shared/permissions';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import UserPanel from './UserPanel';
import type { Channel, Category } from '@shared/types';

const CHANNEL_ICON = {
  TEXT: Hash,
  VOICE: Volume2,
  ANNOUNCEMENT: Megaphone,
};

export default function ChannelSidebar({ serverId }: { serverId: string }) {
  const navigate = useNavigate();
  const detail = useServerStore((s) => s.details[serverId]);
  const { channelId: activeChannelId } = useActiveIds();
  const open = useModalStore((s) => s.open);
  const openContextMenu = useModalStore((s) => s.openContextMenu);
  const { can, isOwner } = usePermissions(serverId);
  const canManageServer = isOwner || can(Permission.MANAGE_SERVER) || can(Permission.MANAGE_ROLES);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (!detail) {
    return (
      <div className="flex w-full flex-col gap-2 p-3">
        <div className="skeleton h-12 w-full rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-full rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }

  const uncategorized = detail.channels.filter((c) => !c.categoryId);
  const categories = [...detail.categories].sort((a, b) => a.position - b.position);

  function headerMenu(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(rect.left + 8, rect.bottom + 4, [
      { label: 'Invite People', icon: <UserPlus size={15} />, onClick: () => open('invite', { serverId }) },
      ...(can(Permission.MANAGE_CHANNELS) ? [{ label: 'Create Channel', icon: <Plus size={15} />, onClick: () => open('createChannel', { serverId }) }] : []),
      ...(can(Permission.MANAGE_SERVER) || can(Permission.MANAGE_ROLES) ? [{ label: 'Server Settings', icon: <Settings size={15} />, onClick: () => open('serverSettings', { serverId }) }] : []),
    ]);
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-surface/70">
      {/* Header */}
      <div
        className="flex items-center gap-1 border-b border-line/50 px-3 py-3"
        style={{ boxShadow: `inset 0 40px 60px -60px ${detail.bannerColor}` }}
      >
        <button
          onClick={headerMenu}
          className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/5"
        >
          <span className="truncate font-display font-bold">{detail.name}</span>
          <ChevronDown size={18} className="shrink-0 text-muted transition group-hover:text-content" />
        </button>
        {canManageServer && (
          <Tooltip content="Server Settings">
            <button
              onClick={() => open('serverSettings', { serverId })}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-content"
              aria-label="Server Settings"
            >
              <Settings size={17} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Channels */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-thin px-2 py-3">
        {uncategorized.length > 0 && (
          <div className="space-y-0.5">
            {uncategorized.map((c) => (
              <ChannelItem key={c.id} channel={c} active={c.id === activeChannelId} serverId={serverId} onNavigate={navigate} />
            ))}
          </div>
        )}
        {categories.map((cat) => (
          <CategoryGroup
            key={cat.id}
            category={cat}
            channels={detail.channels.filter((c) => c.categoryId === cat.id).sort((a, b) => a.position - b.position)}
            collapsed={collapsed.has(cat.id)}
            onToggle={() => toggle(cat.id)}
            activeChannelId={activeChannelId}
            serverId={serverId}
            canManage={can(Permission.MANAGE_CHANNELS)}
            onCreate={() => open('createChannel', { serverId, categoryId: cat.id })}
            onNavigate={navigate}
          />
        ))}
      </div>

      <UserPanel />
    </div>
  );
}

function CategoryGroup({
  category,
  channels,
  collapsed,
  onToggle,
  activeChannelId,
  serverId,
  canManage,
  onCreate,
  onNavigate,
}: {
  category: Category;
  channels: Channel[];
  collapsed: boolean;
  onToggle: () => void;
  activeChannelId: string | null;
  serverId: string;
  canManage: boolean;
  onCreate: () => void;
  onNavigate: (to: string) => void;
}) {
  return (
    <div>
      <div className="group flex items-center gap-1 px-1.5">
        <button onClick={onToggle} className="flex flex-1 items-center gap-0.5 py-1 text-[11px] font-bold uppercase tracking-wide text-faint transition hover:text-muted">
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="truncate">{category.name}</span>
        </button>
        {canManage && (
          <Tooltip content="Create Channel">
            <button onClick={onCreate} className="p-1 text-faint opacity-0 transition hover:text-content group-hover:opacity-100">
              <Plus size={14} />
            </button>
          </Tooltip>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="mt-0.5 space-y-0.5">
              {channels.map((c) => (
                <ChannelItem key={c.id} channel={c} active={c.id === activeChannelId} serverId={serverId} onNavigate={onNavigate} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChannelItem({ channel, active, serverId, onNavigate }: { channel: Channel; active: boolean; serverId: string; onNavigate: (to: string) => void }) {
  const Icon = CHANNEL_ICON[channel.type] ?? Hash;
  const unread = useMessageStore((s) => s.unread[channel.id] ?? 0);
  const mentions = useMessageStore((s) => s.mentions[channel.id] ?? 0);
  const voiceParticipants = useServerStore((s) => s.voiceStates[channel.id]);
  const openContextMenu = useModalStore((s) => s.openContextMenu);
  const open = useModalStore((s) => s.open);
  const { can } = usePermissions(serverId);
  const isVoice = channel.type === 'VOICE';
  const hasUnread = unread > 0 && !active;

  function onClick() {
    if (isVoice) {
      void useVoiceStore.getState().join(channel.id);
    }
    onNavigate(`/channels/${serverId}/${channel.id}`);
  }

  function menu(e: React.MouseEvent) {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, [
      { label: 'Invite People', icon: <UserPlus size={15} />, onClick: () => open('invite', { serverId }) },
      ...(can(Permission.MANAGE_CHANNELS)
        ? [{ label: 'Edit Channel', icon: <Settings size={15} />, onClick: () => open('serverSettings', { serverId, channelId: channel.id }) }]
        : []),
    ]);
  }

  return (
    <div>
      <button
        onClick={onClick}
        onContextMenu={menu}
        className={cn(
          'group relative flex w-full items-center gap-1.5 rounded-lg px-2 py-[7px] text-[15px] transition',
          active ? 'bg-surface-3/80 text-content' : hasUnread ? 'text-content hover:bg-white/5' : 'text-muted hover:bg-white/5 hover:text-content',
        )}
      >
        {hasUnread && <span className="absolute -left-0.5 h-2 w-1 rounded-r-full bg-white" />}
        <Icon size={18} className="shrink-0 text-faint" />
        <span className={cn('flex-1 truncate text-left', hasUnread && 'font-semibold')}>{channel.name}</span>
        {channel.isNsfw && <Lock size={12} className="text-faint" />}
        {mentions > 0 && !active && (
          <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{mentions}</span>
        )}
      </button>
      {isVoice && voiceParticipants && voiceParticipants.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-line/50 pl-2">
          {voiceParticipants.map((p) => (
            <div key={p.userId} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm text-muted">
              <div className={cn('rounded-full transition', p.speaking && 'ring-2 ring-success')}>
                <Avatar userId={p.userId} name={p.displayName} size={22} />
              </div>
              <span className="flex-1 truncate">{p.displayName}</span>
              {p.deafened ? <Headphones size={13} className="text-danger" /> : p.muted ? <MicOff size={13} className="text-danger" /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
