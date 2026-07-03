import { useEffect, useState } from 'react';
import { Search, Loader2, BadgeCheck, ShieldCheck } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges } from '@/components/ui/RoleBadges';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@shared/types';

type BadgeField = 'verified' | 'og' | 'adminBadge';

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
    const badges = field === 'verified' ? { verified: next } : field === 'og' ? { og: next } : { adminBadge: next };
    try {
      const { user: updated } = await api.admin.setBadges(user.id, badges);
      setResults((rs) => rs.map((u) => (u.id === updated.id ? updated : u)));
      const me = useAuthStore.getState().user;
      if (me && updated.id === me.id) {
        useAuthStore.getState().patchUser({ verified: updated.verified, og: updated.og, adminBadge: updated.adminBadge });
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
            <Avatar userId={u.id} name={u.displayName} src={u.avatarUrl} size={38} presence={u.presence} showPresence />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{u.displayName}</span>
                <RoleBadges admin={u.adminBadge} verified={u.verified} og={u.og} size={13} />
              </div>
              <span className="text-xs text-muted">@{u.username}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <BadgeToggle active={u.adminBadge} variant="admin" onClick={() => toggle(u, 'adminBadge')}>
                <ShieldCheck size={13} /> Admin
              </BadgeToggle>
              <BadgeToggle active={u.verified} variant="verified" onClick={() => toggle(u, 'verified')}>
                <BadgeCheck size={13} /> Verified
              </BadgeToggle>
              <BadgeToggle active={u.og} variant="og" onClick={() => toggle(u, 'og')}>
                OG
              </BadgeToggle>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function BadgeToggle({ active, onClick, children, variant }: { active: boolean; onClick: () => void; children: React.ReactNode; variant: 'verified' | 'og' | 'admin' }) {
  const style = active
    ? variant === 'og'
      ? { background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))' }
      : variant === 'verified'
        ? { background: '#3b9dff' }
        : { background: 'rgb(var(--c-accent))' }
    : undefined;
  return (
    <button
      onClick={onClick}
      style={style}
      className={cn('flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold transition', active ? 'text-white' : 'bg-surface-3/70 text-muted hover:text-content')}
    >
      {children}
    </button>
  );
}
