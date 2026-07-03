import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  className?: string;
  wide?: boolean;
  hideClose?: boolean;
}

export default function Modal({ onClose, children, title, subtitle, footer, className, wide, hideClose }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className={cn('glass-strong relative z-10 flex max-h-[86vh] w-full flex-col overflow-hidden rounded-3xl shadow-panel', wide ? 'max-w-3xl' : 'max-w-md', className)}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-line/50 px-6 py-4">
            <div>
              {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
            {!hideClose && (
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-white/10 hover:text-content" aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line/50 bg-black/10 px-6 py-4">{footer}</div>}
      </motion.div>
    </div>
  );
}
