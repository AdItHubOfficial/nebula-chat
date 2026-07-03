import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Check, Copy, LogOut, Smile, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useModalStore } from '@/store/modalStore';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { useUserBadges } from '@/hooks/useUserBadges';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges } from '@/components/ui/RoleBadges';
import { PRESENCE_META, cn } from '@/lib/utils';
import type { PresenceState } from '@shared/types';

const STATUSES: { key: PresenceState; label: string; desc?: string }[] = [
  { key: 'ONLINE', label: 'Online' },
  { key: 'IDLE', label: 'Idle' },
  { key: 'DND', label: 'Do Not Disturb', desc: 'No notifications' },
  { key: 'INVISIBLE', label: 'Invisible', desc: 'Appear offline' },
];

export default function AccountPopover({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const openModal = useModalStore((s) => s.open);
  const { owner, admin } = useUserBadges(user?.id);
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState(user?.customStatus ?? '');
  const [showStatuses, setShowStatuses] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!user) return null;

  async function setPresence(p: PresenceState) {
    useAuthStore.getState().patchUser({ presence: p });
    setShowStatuses(false);
    try {
      await api.users.updateMe({ presence: p });
    } catch {
      /* ignore */
    }
  }

  async function saveStatus() {
    const t = statusText.trim();
    useAuthStore.getState().patchUser({ customStatus: t });
    setEditingStatus(false);
    try {
      await api.users.updateMe({ customStatus: t });
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[64]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong absolute bottom-full left-1.5 z-[66] mb-2 w-[290px] overflow-hidden rounded-2xl shadow-panel"
      >
        {/* Banner */}
        <div className="h-16" style={{ background: `linear-gradient(120deg, ${user.bannerColor}, rgb(var(--c-accent-2)))` }} />
        <div className="px-3 pb-3">
          <div className="-mt-9 mb-2 w-fit rounded-full border-4 border-surface">
            <Avatar userId={user.id} name={user.displayName} src={user.avatarUrl} size={60} presence={user.presence} showPresence />
          </div>

          <div className="rounded-xl bg-black/25 p-3">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-base font-bold leading-tight">{user.displayName}</h3>
              <RoleBadges owner={owner} admin={admin} size={16} />
            </div>
            <p className="text-xs text-muted">@{user.username}</p>

            {editingStatus ? (
              <div className="mt-2.5 flex items-center gap-1.5">
                <input
                  autoFocus
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveStatus();
                    if (e.key === 'Escape') setEditingStatus(false);
                  }}
                  placeholder="What's happening?"
                  maxLength={128}
                  className="input py-1.5 text-sm"
                />
                <button onClick={() => void saveStatus()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-white" title="Save">
                  <Check size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setStatusText(user.customStatus);
                  setEditingStatus(true);
                }}
                className="mt-2.5 flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm text-muted transition hover:bg-white/5"
              >
                <Smile size={15} className="shrink-0" />
                <span className="truncate">{user.customStatus || 'Set a custom status'}</span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 space-y-0.5">
            <MenuRow
              icon={<Pencil size={16} />}
              label="Edit Profile"
              onClick={() => {
                onClose();
                openModal('settings', { tab: 'My Account' });
              }}
            />

            {/* Status selector */}
            <button
              onClick={() => setShowStatuses((s) => !s)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-content transition hover:bg-white/5"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRESENCE_META[user.presence].color }} />
              <span className="flex-1">{PRESENCE_META[user.presence].label}</span>
              <ChevronRight size={15} className={cn('text-faint transition-transform', showStatuses && 'rotate-90')} />
            </button>

            {showStatuses && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden pl-2">
                {STATUSES.map((s) => (
                  <button key={s.key} onClick={() => void setPresence(s.key)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRESENCE_META[s.key].color }} />
                    <span className="flex-1">
                      {s.label}
                      {s.desc && <span className="block text-[11px] text-faint">{s.desc}</span>}
                    </span>
                    {user.presence === s.key && <Check size={15} className="text-accent" />}
                  </button>
                ))}
              </motion.div>
            )}

            <div className="my-1 h-px bg-line/50" />

            <MenuRow
              icon={<Copy size={16} />}
              label="Copy Username"
              onClick={() => {
                void navigator.clipboard.writeText(user.username);
                toast.success('Copied', `@${user.username}`);
                onClose();
              }}
            />
            <MenuRow
              icon={<LogOut size={16} />}
              label="Log Out"
              danger
              onClick={() => {
                onClose();
                useAuthStore.getState().logout();
              }}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function MenuRow({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition', danger ? 'text-danger hover:bg-danger/10' : 'text-content hover:bg-white/5')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
