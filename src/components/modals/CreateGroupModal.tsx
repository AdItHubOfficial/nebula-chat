import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, X, Check, Users } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { useFriendStore } from '@/store/friendStore';
import { useDMStore } from '@/store/dmStore';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@shared/types';

export default function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const friends = useFriendStore((s) => s.friends);
  const meId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    useFriendStore.getState().load();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { items } = await api.users.search(q);
        setSearchResults(items);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const acceptedFriends = friends.filter((f) => f.status === 'ACCEPTED').map((f) => f.user);
  const list = (query.trim() ? searchResults : acceptedFriends).filter((u) => u.id !== meId);

  function toggle(u: PublicUser) {
    setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));
  }

  async function create() {
    if (selected.length === 0) return;
    setCreating(true);
    try {
      const { dm } = await api.dms.group(
        selected.map((u) => u.id),
        name.trim() || undefined,
      );
      useDMStore.getState().upsertDM(dm);
      onClose();
      navigate(`/channels/@me/${dm.id}`);
    } catch (err) {
      toast.error('Could not create group', (err as Error).message);
      setCreating(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create Group Chat" subtitle="Add people to start a group conversation.">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <button key={u.id} onClick={() => toggle(u)} className="flex items-center gap-1 rounded-full bg-accent/20 py-1 pl-1 pr-2 text-sm text-accent transition hover:bg-accent/30">
              <Avatar userId={u.id} name={u.displayName} src={u.avatarUrl} size={20} />
              {u.displayName}
              <X size={13} />
            </button>
          ))}
        </div>
      )}

      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Group name (optional)</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Squad" maxLength={64} className="input mb-3" />

      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people to add…" className="input pl-9" />
      </div>

      <div className="max-h-64 min-h-[80px] space-y-1 overflow-y-auto scrollbar-thin">
        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">{query.trim() ? 'No one found.' : 'No friends yet — search for people above.'}</p>
        )}
        {list.map((u) => {
          const on = selected.some((x) => x.id === u.id);
          return (
            <button key={u.id} onClick={() => toggle(u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5">
              <Avatar userId={u.id} name={u.displayName} src={u.avatarUrl} size={34} presence={u.presence} showPresence />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{u.displayName}</div>
                <div className="truncate text-xs text-muted">@{u.username}</div>
              </div>
              <span className={cn('grid h-5 w-5 place-items-center rounded-md border-2 transition', on ? 'border-accent bg-accent text-white' : 'border-line')}>
                {on && <Check size={13} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-muted">{selected.length} selected</span>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={create} disabled={creating || selected.length === 0} className="btn-primary">
            {creating ? <Loader2 className="animate-spin" size={18} /> : (<><Users size={16} /> Create Group</>)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
