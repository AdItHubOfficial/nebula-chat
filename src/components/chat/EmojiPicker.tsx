import { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { EMOJI_CATEGORIES, EMOJI_KEYWORDS } from '@shared/emoji';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export default function EmojiPicker({ onSelect, onClose, className }: EmojiPickerProps) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState(EMOJI_CATEGORIES[0].id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const matches: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) {
        const kws = EMOJI_KEYWORDS[e];
        if ((kws && kws.some((k) => k.includes(q))) || cat.label.toLowerCase().includes(q)) matches.push(e);
      }
    }
    return [...new Set(matches)];
  }, [query]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('glass-strong flex h-80 w-80 flex-col overflow-hidden rounded-2xl shadow-panel', className)}
    >
      <div className="p-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search emoji" className="input py-1.5 pl-8 text-sm" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2.5 pb-2">
        {filtered ? (
          <Grid emojis={filtered} onSelect={onSelect} />
        ) : (
          EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.id} id={`cat-${cat.id}`} className="mb-2">
              <h4 className="sticky top-0 z-10 bg-surface-2/80 py-1 text-[11px] font-bold uppercase tracking-wide text-faint backdrop-blur">{cat.label}</h4>
              <Grid emojis={cat.emojis} onSelect={onSelect} />
            </div>
          ))
        )}
        {filtered && filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">No emoji found</p>}
      </div>

      {!filtered && (
        <div className="flex items-center gap-0.5 border-t border-line/50 px-2 py-1.5">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCat(cat.id);
                document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={cn('grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-white/10', activeCat === cat.id && 'bg-white/10')}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Grid({ emojis, onSelect }: { emojis: string[]; onSelect: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((e, i) => (
        <button key={`${e}-${i}`} onClick={() => onSelect(e)} className="grid h-9 w-9 place-items-center rounded-lg text-xl transition hover:scale-110 hover:bg-white/10" title={e}>
          {e}
        </button>
      ))}
    </div>
  );
}
