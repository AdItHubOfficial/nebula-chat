import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Download } from 'lucide-react';
import { useModalStore } from '@/store/modalStore';

export default function Lightbox() {
  const lightbox = useModalStore((s) => s.lightbox);
  const close = useModalStore((s) => s.closeLightbox);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, close]);

  if (!lightbox) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/85 p-8" onClick={close}>
      <motion.img
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        src={lightbox.url}
        alt={lightbox.filename ?? ''}
        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-panel"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="mt-4 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <a href={lightbox.url} download={lightbox.filename} target="_blank" rel="noreferrer" className="btn-soft text-sm"><Download size={15} /> Download</a>
        <button onClick={close} className="btn-soft text-sm"><X size={15} /> Close</button>
      </div>
    </motion.div>
  );
}
