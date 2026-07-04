import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { Search, Loader2, BadgeCheck, ShieldCheck, Crown } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges } from '@/components/ui/RoleBadges';
import Tooltip from '@/components/ui/Tooltip';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@shared/types';

type BadgeField = 'ownerBadge' | 'coOwnerBadge' | 'adminBadge' | 'verified' | 'og';

const TOGGLES: { field: BadgeField; title: string; icon: ReactNode; activeStyle: CSSProperties }[] = [
  { field: 'ownerBadge', title: 'Owner', icon: <Crown size={14} fill="currentColor" strokeWidth={1.25} />, activeStyle: { background: '#f5b942', color: '#3a2a00' } },
  { field: 'coOwnerBadge', title: 'Co-Owner', icon: <Crown size={14} fill="currentColor" strokeWidth={1.25} />, activeStyle: { background: '#9fb3c8', color: '#10151c' } },
  { field: 'adminBadge', title: 'Admin', icon: <ShieldCheck size={14} />, activeStyle: { background: 'rgb(var(--c-accent))', color: '#fff' } },
  { field: 'verified', title: 'Verified', icon: <BadgeCheck size={14} />, activeStyle: { background: '#3b9dff', color: '#fff' } },
  { field: 'og', title: 'OG', icon: <span className="text-[10px] font-black leading-none">OG</span>, activeStyle: { background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))', color: '#fff' } },
];

// Founder-only panel: search any account and grant/remove badges.
export default function AdminBadgesModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { items } = await api.users.search(q);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function toggle(user: PublicUser, field: BadgeField) {
    const next = !user[field];
    setResults((rs) => rs.map((u) => (u.id === user.id ? { ...u, [field]: next } : u)));
    const badges = { [field]: next } as { [K in BadgeField]?: boolean };
    try {
      const { user: updated } = await api.admin.setBadges(user.id, badges);
      setResults((rs) => rs.map((u) => (u.id === updated.id ? updated : u)));
      const me = useAuthStore.getState().user;
      if (me && updated.id === me.id) {
        useAuthStore.getState().patchUser({
          verified: updated.verified,
          og: updated.og,
          adminBadge: updated.adminBadge,
          ownerBadge: updated.ownerBadge,
          coOwnerBadge: updated.coOwnerBadge,
        });
      }
      toast.success('Badges updated', updated.displayName);
    } catch (err) {
      setResults((rs) => rs.map((u) => (u.id === user.id ? { ...u, [field]: !next } : u)));
      toast.error('Could not update', (err as Error).message);
    }
  }

  return (
    <Modal onClose={onClose} title="Founder Panel" subtitle="Search any account and grant badges." className="max-w-lg">
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or name…" className="input pl-9" />
      </div>

      <div className="min-h-[120px] space-y-1.5">
        {loading && (
          <div className="flex justify-center py-8 text-muted">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {!loading && query.trim() && results.length === 0 && <p className="py-8 text-center text-sm text-muted">No accounts found.</p>}
        {!loading && !query.trim() && (
          <p className="py-8 text-center text-sm text-muted">Start typing a username (try <span className="font-mono text-accent">nebula</span> to badge yourself).</p>
        )}
        {results.map((u) => (
          <div key={u.id} className="flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/50 p-2.5">
            <Avatar userId={u.id} name={u.displayName} src={u.avatarUrl} size={36} presence={u.presence} showPresence />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{u.displayName}</span>
                <RoleBadges owner={u.ownerBadge} coOwner={u.coOwnerBadge} admin={u.adminBadge} verified={u.verified} og={u.og} size={13} />
              </div>
              <span className="text-xs text-muted">@{u.username}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {TOGGLES.map((t) => {
                const active = u[t.field];
                return (
                  <Tooltip key={t.field} content={t.title}>
                    <button
                      onClick={() => toggle(u, t.field)}
                      style={active ? t.activeStyle : undefined}
                      className={cn('grid h-8 w-8 place-items-center rounded-lg transition', !active && 'bg-surface-3/70 text-muted hover:text-content')}
                    >
                      {t.icon}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
