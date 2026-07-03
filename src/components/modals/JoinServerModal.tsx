import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useServerStore } from '@/store/serverStore';
import { toast } from '@/store/toastStore';

export default function JoinServerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  function parseCode(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/\/invite\/([^/?\s]+)/);
    return (match ? match[1] : trimmed).replace(/^https?:\/\/\S+\//, '');
  }

  async function join() {
    const code = parseCode(value);
    if (!code) return;
    setLoading(true);
    try {
      const { server } = await api.invites.join(code);
      await useServerStore.getState().loadServers();
      if (server) {
        await useServerStore.getState().loadServer(server.id);
        toast.success('Joined server', server.name);
        onClose();
        navigate(`/channels/${server.id}`);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error('Could not join', (err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Join a Server" subtitle="Enter an invite to join an existing server.">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Invite link or code</label>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} placeholder="nebula-hq  or  http://localhost:5173/invite/nebula-hq" className="input" />
      <div className="mt-3 rounded-xl border border-line/60 bg-surface-2/50 px-3.5 py-2.5 text-xs text-muted">
        <span className="font-semibold text-content">Try it:</span> use the code <span className="font-mono text-accent">nebula-hq</span> to join the demo community.
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={join} disabled={loading || !value.trim()} className="btn-primary">
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Join Server'}
        </button>
      </div>
    </Modal>
  );
}
