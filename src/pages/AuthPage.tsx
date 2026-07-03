import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, AtSign, Lock, User, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const FEATURES = ['Real-time messaging', 'Crystal-clear voice rooms', 'Servers, roles & threads', 'Your community, your rules'];

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const error = useAuthStore((s) => s.error);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ login: 'nova', password: 'nebula123', username: '', email: '', displayName: '' });

  const isLogin = mode === 'login';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await useAuthStore.getState().login(form.login, form.password);
      } else {
        await useAuthStore.getState().register({
          username: form.username,
          email: form.email,
          password: form.password,
          displayName: form.displayName || form.username,
        });
      }
      const pendingInvite = localStorage.getItem('nebula.invite');
      navigate(pendingInvite ? `/invite/${pendingInvite}` : '/channels/@me');
    } catch {
      /* error is surfaced from the store */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-gradient flex h-full w-full items-center justify-center overflow-y-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong grid w-full max-w-4xl overflow-hidden rounded-3xl shadow-panel md:grid-cols-2"
      >
        {/* Branding */}
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 md:flex" style={{ background: 'linear-gradient(150deg, rgb(var(--c-accent)/0.35), rgb(var(--c-accent-2)/0.25))' }}>
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-black/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Sparkles className="text-white" size={22} />
            </div>
            <span className="font-display text-xl font-bold text-white">Nebula Chat</span>
          </div>
          <div className="relative">
            <h1 className="font-display text-3xl font-bold leading-tight text-white">Where your galaxy gathers.</h1>
            <p className="mt-3 max-w-xs text-sm text-white/80">A place to talk, hang out, and build your community — voice, text, and everything between.</p>
            <ul className="mt-6 space-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/60">Runs entirely on your machine · localhost</p>
        </div>

        {/* Form */}
        <div className="p-8 sm:p-10">
          <h2 className="font-display text-2xl font-bold">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-1 text-sm text-muted">{isLogin ? 'Sign in to jump back into the conversation.' : 'Join the Nebula in a few seconds.'}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {isLogin ? (
              <Field icon={<AtSign size={16} />} label="Username or email">
                <input className="input pl-9" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="nova" autoComplete="username" required />
              </Field>
            ) : (
              <>
                <Field icon={<User size={16} />} label="Username">
                  <input className="input pl-9" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="stardust" autoComplete="username" required />
                </Field>
                <Field icon={<Sparkles size={16} />} label="Display name">
                  <input className="input pl-9" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Stardust" />
                </Field>
                <Field icon={<Mail size={16} />} label="Email">
                  <input className="input pl-9" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@nebula.chat" autoComplete="email" required />
                </Field>
              </>
            )}
            <Field icon={<Lock size={16} />} label="Password">
              <input className="input pl-9" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} required />
            </Field>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
                {error}
              </motion.p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-accent hover:underline">
              {isLogin ? 'Register' : 'Sign in'}
            </Link>
          </p>

          {isLogin && (
            <div className="mt-5 rounded-xl border border-line/60 bg-surface-2/50 px-3.5 py-2.5 text-xs text-muted">
              <span className="font-semibold text-content">Demo:</span> username <span className="font-mono text-accent">nova</span> · password{' '}
              <span className="font-mono text-accent">nebula123</span> (also: orbit, pixel, echo, comet…)
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">{icon}</span>
        {children}
      </div>
    </label>
  );
}
