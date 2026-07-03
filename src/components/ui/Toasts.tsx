import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

const ICONS = {
  success: <CheckCircle2 size={18} className="text-success" />,
  info: <Info size={18} className="text-accent" />,
  error: <AlertTriangle size={18} className="text-danger" />,
};

export default function Toasts() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-80 flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5 shadow-panel"
          >
            <div className="mt-0.5">{ICONS[t.type]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-faint transition hover:text-content">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
