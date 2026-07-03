import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useModalStore } from '@/store/modalStore';
import { cn } from '@/lib/utils';

export default function ContextMenu() {
  const { contextMenu, closeContextMenu } = useModalStore();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!contextMenu || !ref.current) return;
    const { innerWidth, innerHeight } = window;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.min(contextMenu.x, innerWidth - rect.width - 8);
    const y = Math.min(contextMenu.y, innerHeight - rect.height - 8);
    setPos({ x, y });
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => closeContextMenu();
    // Defer attaching the outside-click listener to the next tick so the very
    // click/tap that opened this menu doesn't immediately close it again.
    const id = window.setTimeout(() => {
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      style={{ left: pos.x, top: pos.y }}
      className="glass-strong fixed z-[70] min-w-[200px] rounded-xl p-1.5 shadow-panel"
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 h-px bg-line/60" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              closeContextMenu();
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40',
              item.danger ? 'text-danger hover:bg-danger/15' : 'text-content hover:bg-accent hover:text-white',
            )}
          >
            {item.icon && <span className="grid h-4 w-4 place-items-center">{item.icon}</span>}
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        ),
      )}
    </motion.div>
  );
}
