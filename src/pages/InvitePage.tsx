import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Users, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useServerStore } from '@/store/serverStore';
import { api, ApiError } from '@/lib/api';
import { abbreviateServer } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import type { ServerSummary } from '@shared/types';

interface Preview {
  code: string;
  server: ServerSummary;
  memberCount: number;
  inviter: { id: string; displayName: string };
}

export default function InvitePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (status !== 'authed') {
      localStorage.setItem('nebula.invite', code);
      return;
    }
    api.invites
      .preview(code)
      .then((r) => setPreview(r.invite))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Invite not found'));
  }, [code, status]);

  async function join() {
    setJoining(true);
    try {
      const { server } = await api.invites.join(code);
      localStorage.removeItem('nebula.invite');
      await useServerStore.getState().loadServers();
      if (server) {
        await useServerStore.getState().loadServer(server.id);
        toast.success('Joined server', server.name);
        navigate(`/channels/${server.id}`);
      } else navigate('/channels/@me');
    } catch (e) {
      toast.error('Could not join', e instanceof ApiError ? e.message : 'Try again');
      setJoining(false);
    }
  }

  return (
    <div className="app-gradient flex h-full w-full items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong w-full max-w-sm rounded-3xl p-8 text-center shadow-panel">
        {status !== 'authed' ? (
          <>
            <h1 className="font-display text-xl font-bold">You've been invited!</h1>
            <p className="mt-2 text-sm text-muted">Sign in or create an account to accept this invite.</p>
            <Link to="/login" className="btn-primary mt-6 w-full">Continue</Link>
          </>
        ) : error ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-danger/15 text-2xl">💔</div>
            <h1 className="mt-4 font-display text-xl font-bold">Invite invalid</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <Link to="/channels/@me" className="btn-soft mt-6 w-full">Back to Nebula</Link>
          </>
        ) : preview ? (
          <>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl text-2xl font-bold text-white shadow-glow" style={{ background: `linear-gradient(135deg, ${preview.server.bannerColor}, rgb(var(--c-accent-2)))` }}>
              {preview.server.iconUrl ? <img src={preview.server.iconUrl} alt="" className="h-full w-full rounded-3xl object-cover" /> : abbreviateServer(preview.server.name)}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{preview.inviter.displayName} invited you to join</p>
            <h1 className="mt-1 font-display text-2xl font-bold">{preview.server.name}</h1>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
              <Users size={14} /> {preview.memberCount} member{preview.memberCount === 1 ? '' : 's'}
            </div>
            <button onClick={join} disabled={joining} className="btn-primary mt-6 w-full py-2.5">
              {joining ? <Loader2 className="animate-spin" size={18} /> : (<>Accept Invite <ArrowRight size={16} /></>)}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-muted">
            <Loader2 className="animate-spin" size={28} /> Loading invite…
          </div>
        )}
      </motion.div>
    </div>
  );
}
