import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useServerStore } from '@/store/serverStore';
import { toast } from '@/store/toastStore';
import { abbreviateServer } from '@/lib/utils';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#22d3ee', '#34d399', '#f59e0b', '#f43f5e', '#38bdf8'];

export default function CreateServerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadIcon(file: File) {
    try {
      const res = await api.uploads.single(file);
      setIconUrl(res.url);
    } catch (err) {
      toast.error('Upload failed', (err as Error).message);
    }
  }

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { server } = await api.servers.create({ name: name.trim(), bannerColor: color, iconUrl: iconUrl ?? undefined });
      useServerStore.getState().upsertServerSummary(server);
      useServerStore.getState().applyServerDetail(server);
      toast.success('Server created', server.name);
      onClose();
      navigate(`/channels/${server.id}`);
    } catch (err) {
      toast.error('Could not create server', (err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create a Server" subtitle="Your server is where you and your friends hang out.">
      <div className="flex flex-col items-center gap-5">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-line text-white transition hover:border-accent"
          style={{ background: iconUrl ? undefined : `linear-gradient(135deg, ${color}, rgb(var(--c-accent-2)))` }}
        >
          {iconUrl ? (
            <img src={iconUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : name ? (
            <span className="font-display text-xl font-bold">{abbreviateServer(name)}</span>
          ) : (
            <Upload size={22} />
          )}
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-accent text-white">+</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadIcon(e.target.files[0])} />
        </button>

        <div className="w-full">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Server name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="My Awesome Server" className="input" />
        </div>

        <div className="w-full">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Accent</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="h-8 w-8 rounded-full transition hover:scale-110" style={{ background: c, boxShadow: color === c ? `0 0 0 3px rgb(var(--c-surface)), 0 0 0 5px ${c}` : undefined }} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={create} disabled={loading || !name.trim()} className="btn-primary">
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Server'}
        </button>
      </div>
    </Modal>
  );
}
