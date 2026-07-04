import { useNavigate } from 'react-router-dom';
import { IdCard, MessageSquare, UserPlus, Clock, UserMinus, Ban, ShieldOff, Copy } from 'lucide-react';
import { useModalStore, type ContextMenuItem } from '@/store/modalStore';
import { useDMStore } from '@/store/dmStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import type { PublicUser } from '@shared/types';

interface Ctx {
  serverId?: string;
  canKick?: boolean;
  canBan?: boolean;
  canTimeout?: boolean;
  isOwnerTarget?: boolean;
}

// Builds and opens a right-click context menu for a user (profile, message,
// add friend, block, and — with permission + server context — moderation).
export function useUserMenu() {
  const navigate = useNavigate();
  const openContextMenu = useModalStore((s) => s.openContextMenu);
  const open = useModalStore((s) => s.open);

  async function message(userId: string) {
    try {
      const dm = await useDMStore.getState().openDM(userId);
      navigate(`/channels/@me/${dm.id}`);
    } catch (e) {
      toast.error('Could not open DM', (e as Error).message);
    }
  }

  return function openUserMenu(target: PublicUser, x: number, y: number, ctx: Ctx = {}) {
    const me = useAuthStore.getState().user;
    const isSelf = target.id === me?.id;
    const items: ContextMenuItem[] = [
      { label: 'View Profile', icon: <IdCard size={15} />, onClick: () => open('userProfile', { userId: target.id }) },
    ];

    if (!isSelf) {
      items.push({ label: 'Message', icon: <MessageSquare size={15} />, onClick: () => void message(target.id) });
      items.push({
        label: 'Add Friend',
        icon: <UserPlus size={15} />,
        onClick: async () => {
          try {
            await api.friends.request(target.username);
            toast.success('Friend request sent', `to ${target.displayName}`);
          } catch (e) {
            toast.error('Could not send request', (e as Error).message);
          }
        },
      });
    }

    if (!isSelf && !ctx.isOwnerTarget && ctx.serverId) {
      const mod: ContextMenuItem[] = [];
      if (ctx.canTimeout)
        mod.push({
          label: 'Timeout (10 min)',
          icon: <Clock size={15} />,
          onClick: async () => {
            try {
              await api.servers.timeout(ctx.serverId!, target.id, 10);
              toast.success('Timed out', `${target.displayName} · 10 min`);
            } catch (e) {
              toast.error('Failed', (e as Error).message);
            }
          },
        });
      if (ctx.canKick)
        mod.push({
          label: 'Kick from Server',
          icon: <UserMinus size={15} />,
          danger: true,
          onClick: async () => {
            if (!confirm(`Kick ${target.displayName} from the server?`)) return;
            try {
              await api.servers.kick(ctx.serverId!, target.id);
              toast.info('Kicked', target.displayName);
            } catch (e) {
              toast.error('Failed', (e as Error).message);
            }
          },
        });
      if (ctx.canBan)
        mod.push({
          label: 'Ban from Server',
          icon: <Ban size={15} />,
          danger: true,
          onClick: async () => {
            if (!confirm(`Ban ${target.displayName}? They won't be able to rejoin.`)) return;
            try {
              await api.servers.ban(ctx.serverId!, target.id);
              toast.info('Banned', target.displayName);
            } catch (e) {
              toast.error('Failed', (e as Error).message);
            }
          },
        });
      if (mod.length) {
        items.push({ separator: true });
        items.push(...mod);
      }
    }

    if (!isSelf) {
      items.push({ separator: true });
      items.push({
        label: 'Block',
        icon: <ShieldOff size={15} />,
        danger: true,
        onClick: async () => {
          if (!confirm(`Block ${target.displayName}? You won't see their messages.`)) return;
          try {
            await api.friends.block(target.id);
            toast.info('Blocked', target.displayName);
          } catch (e) {
            toast.error('Failed', (e as Error).message);
          }
        },
      });
    }

    items.push({
      label: 'Copy User ID',
      icon: <Copy size={15} />,
      onClick: () => {
        void navigator.clipboard.writeText(target.id);
        toast.success('Copied user ID');
      },
    });

    openContextMenu(x, y, items);
  };
}
