import { motion } from 'framer-motion';

export default function LoadingScreen({ label = 'Entering the Nebula…' }: { label?: string }) {
  return (
    <div className="app-gradient flex h-full w-full flex-col items-center justify-center gap-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="grid h-24 w-24 place-items-center rounded-3xl"
          style={{ background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))' }}
        >
          <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none">
            <circle cx="32" cy="32" r="6.5" fill="white" />
            <ellipse cx="32" cy="32" rx="20" ry="8" transform="rotate(-28 32 32)" stroke="white" strokeWidth="3" fill="none" />
          </svg>
        </motion.div>
        <motion.div
          className="absolute inset-0 rounded-3xl"
          animate={{ boxShadow: ['0 0 24px 0 rgb(var(--c-accent)/0.5)', '0 0 48px 8px rgb(var(--c-accent)/0.25)', '0 0 24px 0 rgb(var(--c-accent)/0.5)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Nebula Chat</h1>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          {label}
        </div>
      </div>
    </div>
  );
}
