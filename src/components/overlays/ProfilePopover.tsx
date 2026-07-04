import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, UserPlus, IdCard } from 'lucide-react';
import { useModalStore } from '@/store/modalStore';
import { useAuthStore } from '@/store/authStore';
import { useDMStore } from '@/store/dmStore';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { useUserBadges } from '@/hooks/useUserBadges';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges } from '@/components/ui/RoleBadges';
import { PRESENCE_META, cn } from '@/lib/utils';
import { fullTimestamp } from '@/lib/time';
import type { PublicUser } from '@shared/types';

export default function ProfilePopover() {
  const popover = useModalStore((s) => s.profilePopover);
  const close = useModalStore((s) => s.closeProfilePopover);
  const openModal = useModalStore((s) => s.open);
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const badges = useUserBadges(popover?.userId);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    if (!popover) return;
    setUser(null);
    api.users.get(popover.userId).then((r) => setUser(r.user)).catch(() => close());
  }, [popover, close]);

  if (!popover) return null;

  const { rect } = popover;
  const width = 320;
  const height = 380;
  const left = rect.right + width + 16 < window.innerWidth ? rect.right + 12 : Math.max(12, rect.left - width - 12);
  const top = Math.min(Math.max(12, rect.top - 40), window.innerHeight - height - 12);
  const isMe = user?.id === me?.id;

  async function message() {
    if (!user) return;
    close();
    const dm = await useDMStore.getState().openDM(user.id);
    navigate(`/channels/@me/${dm.id}`);
  }

  async function addFriend() {
    if (!user) return;
    try {
      await api.friends.request(user.username);
      toast.success('Friend request sent', `to ${user.displayName}`);
    } catch (err) {
      toast.error('Could not send request', (err as Error).message);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[65]" onClick={close} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        style={{ left, top, width }}
        className="glass-strong fixed z-[66] overflow-hidden rounded-2xl shadow-panel"
      >
        <div className="h-20" style={{ background: `linear-gradient(120deg, ${user?.bannerColor ?? '#6366f1'}, rgb(var(--c-accent-2)))` }} />
        <div className="px-4 pb-4">
          <div className="-mt-9 mb-2">
            {user ? (
              <div className="w-fit rounded-full border-4 border-surface">
                <Avatar userId={user.id} name={user.displayName} src={user.avatarUrl} size={64} presence={user.presence} showPresence />
              </div>
            ) : (
              <div className="skeleton h-16 w-16 rounded-full border-4 border-surface" />
            )}
          </div>
          {user ? (
            <>
              <div className="rounded-2xl bg-black/25 p-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-lg font-bold leading-tight">{user.displayName}</h3>
                  <RoleBadges founder={user.founderBadge} owner={badges.owner || user.ownerBadge} coOwner={user.coOwnerBadge} admin={badges.admin || user.adminBadge} verified={user.verified} og={user.og} size={16} />
                </div>
                <p className="text-sm text-muted">@{user.username}</p>
                {user.customStatus && <p className="mt-2 text-sm text-content">{user.customStatus}</p>}
                <div className="my-2.5 h-px bg-line/50" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: PRESENCE_META[user.presence].color }} />
                  <span className="text-muted">{PRESENCE_META[user.presence].label}</span>
                </div>
                {user.bio && (
                  <>
                    <p className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-faint">About</p>
                    <p className="mt-0.5 text-sm text-content">{user.bio}</p>
                  </>
                )}
                <p className="mt-2.5 text-[11px] font-bold uppercase tracking-wide text-faint">Member Since</p>
                <p className="mt-0.5 text-sm text-muted">{fullTimestamp(user.createdAt).split(' at')[0]}</p>
              </div>
              {!isMe && (
                <div className="mt-3 flex gap-2">
                  <button onClick={message} className="btn-primary flex-1 py-2 text-sm"><MessageSquare size={15} /> Message</button>
                  <button onClick={addFriend} className="btn-soft px-3 py-2 text-sm" title="Add Friend"><UserPlus size={16} /></button>
                  <button onClick={() => { close(); openModal('userProfile', { userId: user.id }); }} className="btn-soft px-3 py-2 text-sm" title="Full Profile"><IdCard size={16} /></button>
                </div>
              )}
            </>
          ) : (
            <div className={cn('space-y-2')}>
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-16 w-full rounded-xl" />
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
