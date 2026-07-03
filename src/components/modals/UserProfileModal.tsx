import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useDMStore } from '@/store/dmStore';
import { toast } from '@/store/toastStore';
import { useUserBadges } from '@/hooks/useUserBadges';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges } from '@/components/ui/RoleBadges';
import { PRESENCE_META } from '@/lib/utils';
import { fullTimestamp } from '@/lib/time';
import type { PublicUser } from '@shared/types';

export default function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const badges = useUserBadges(userId);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    api.users.get(userId).then((r) => setUser(r.user)).catch(() => onClose());
  }, [userId, onClose]);

  async function message() {
    if (!user) return;
    onClose();
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
    <Modal onClose={onClose} hideClose className="max-w-lg">
      {!user ? (
        <div className="flex justify-center py-16 text-muted"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <div className="-mx-6 -my-5">
          <div className="h-32" style={{ background: `linear-gradient(120deg, ${user.bannerColor}, rgb(var(--c-accent-2)))` }} />
          <div className="px-6 pb-6">
            <div className="-mt-12 mb-3 w-fit rounded-full border-[6px] border-surface">
              <Avatar userId={user.id} name={user.displayName} src={user.avatarUrl} size={88} presence={user.presence} showPresence />
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold">{user.displayName}</h2>
                <RoleBadges owner={badges.owner} admin={badges.admin} size={18} />
              </div>
              <p className="text-muted">@{user.username}</p>
              {user.customStatus && <p className="mt-2 text-sm">{user.customStatus}</p>}
              <div className="my-3 h-px bg-line/50" />
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRESENCE_META[user.presence].color }} />
                {PRESENCE_META[user.presence].label}
              </div>
              {user.bio && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-faint">About Me</p>
                  <p className="mt-1 text-sm text-content">{user.bio}</p>
                </div>
              )}
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Member Since</p>
                <p className="mt-1 text-sm text-muted">{fullTimestamp(user.createdAt).split(' at')[0]}</p>
              </div>
            </div>
            {user.id !== me?.id && (
              <div className="mt-4 flex gap-2">
                <button onClick={message} className="btn-primary flex-1"><MessageSquare size={16} /> Message</button>
                <button onClick={addFriend} className="btn-soft"><UserPlus size={16} /> Add Friend</button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
