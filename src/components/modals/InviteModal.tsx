import { useEffect, useState } from 'react';
import { Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useServerStore } from '@/store/serverStore';
import { toast } from '@/store/toastStore';
import type { Invite } from '@shared/types';

export default function InviteModal({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const server = useServerStore((s) => s.details[serverId] ?? s.servers.find((x) => x.id === serverId));
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function ensureInvite(regenerate = false) {
    setLoading(true);
    try {
      if (!regenerate) {
        const { items } = await api.invites.list(serverId);
        if (items.length) {
          setInvite(items[0]);
          setLoading(false);
          return;
        }
      }
      const { invite: created } = await api.invites.create(serverId);
      setInvite(created);
    } catch (err) {
      toast.error('Could not create invite', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void ensureInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  const link = invite ? `${window.location.origin}/invite/${invite.code}` : '';

  function copy() {
    if (!link) return;
    void navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Invite copied!', 'Share it with your friends.');
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal onClose={onClose} title={`Invite friends to ${server?.name ?? 'server'}`} subtitle="Anyone with this link can join.">
      {loading ? (
        <div className="flex justify-center py-8 text-muted"><Loader2 className="animate-spin" size={26} /></div>
      ) : (
        <>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Invite Link</label>
          <div className="flex items-center gap-2 rounded-xl border border-line/60 bg-surface-2/60 p-1.5 pl-3.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-content">{link}</span>
            <button onClick={copy} className="btn-primary shrink-0 px-4 py-2 text-sm">
              {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
            </button>
          </div>
          <button onClick={() => ensureInvite(true)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-accent">
            <RefreshCw size={13} /> Generate a new link
          </button>
        </>
      )}
    </Modal>
  );
}
