import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Volume2, Megaphone, Lock, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { toast } from '@/store/toastStore';
import { cn } from '@/lib/utils';
import type { ChannelType } from '@shared/types';

const TYPES: { type: ChannelType; label: string; desc: string; icon: typeof Hash }[] = [
  { type: 'TEXT', label: 'Text', desc: 'Send messages, images, and more', icon: Hash },
  { type: 'VOICE', label: 'Voice', desc: 'Hang out together with voice', icon: Volume2 },
  { type: 'ANNOUNCEMENT', label: 'Announcement', desc: 'Important updates for members', icon: Megaphone },
];

export default function CreateChannelModal({ serverId, categoryId, onClose }: { serverId: string; categoryId?: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('TEXT');
  const [isPrivate, setPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { channel } = await api.servers.createChannel(serverId, { name: name.trim(), type, categoryId: categoryId ?? null, isPrivate });
      toast.success('Channel created', `#${channel.name}`);
      onClose();
      if (type !== 'VOICE') navigate(`/channels/${serverId}/${channel.id}`);
    } catch (err) {
      toast.error('Could not create channel', (err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Create Channel">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Channel type</label>
          <div className="space-y-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.type} onClick={() => setType(t.type)} className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition', type === t.type ? 'border-accent bg-accent/10' : 'border-line/60 hover:bg-white/5')}>
                  <Icon size={22} className={type === t.type ? 'text-accent' : 'text-muted'} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted">{t.desc}</p>
                  </div>
                  <span className={cn('h-4 w-4 rounded-full border-2', type === t.type ? 'border-accent bg-accent' : 'border-line')} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Channel name</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint">{type === 'VOICE' ? <Volume2 size={16} /> : <Hash size={16} />}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder={type === 'VOICE' ? 'General' : 'new-channel'} className="input pl-9" />
          </div>
        </div>

        <button onClick={() => setPrivate((p) => !p)} className="flex w-full items-center gap-3 rounded-xl border border-line/60 p-3 text-left transition hover:bg-white/5">
          <Lock size={18} className="text-muted" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Private Channel</p>
            <p className="text-xs text-muted">Only selected members can view</p>
          </div>
          <span className={cn('relative h-5 w-9 rounded-full transition', isPrivate ? 'bg-accent' : 'bg-surface-3')}>
            <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', isPrivate ? 'left-4' : 'left-0.5')} />
          </span>
        </button>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={create} disabled={loading || !name.trim()} className="btn-primary">
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Create Channel'}
        </button>
      </div>
    </Modal>
  );
}
