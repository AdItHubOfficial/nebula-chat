import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Smile, Send, X, Reply, FileImage, Film, File as FileIcon, Gift, Slash } from 'lucide-react';
import { useMessageStore, type ClientMessage } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { api } from '@/lib/api';
import { emitAck, emit } from '@/lib/socket';
import { SocketEvents } from '@shared/events';
import { toast } from '@/store/toastStore';
import { cn, formatBytes, isImage, isVideo } from '@/lib/utils';
import EmojiPicker from './EmojiPicker';

interface ComposerProps {
  channelId?: string;
  dmId?: string;
  placeholder: string;
  canSend?: boolean;
}

interface PendingUrl {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

const SLASH_COMMANDS = [
  { name: 'shrug', desc: 'Appends ¯\\_(ツ)_/¯', hint: '/shrug' },
  { name: 'tableflip', desc: 'Appends (╯°□°)╯︵ ┻━┻', hint: '/tableflip' },
  { name: 'unflip', desc: 'Appends ┬─┬ ノ( ゜-゜ノ)', hint: '/unflip' },
  { name: 'lenny', desc: 'Appends ( ͡° ͜ʖ ͡°)', hint: '/lenny' },
  { name: 'me', desc: 'Displays text as an action (italic)', hint: '/me [message]' },
  { name: 'spoiler', desc: 'Marks your message as a spoiler', hint: '/spoiler [message]' },
];

function applySlash(text: string): string {
  const [cmd, ...rest] = text.split(' ');
  const arg = rest.join(' ').trim();
  switch (cmd) {
    case '/shrug':
      return `${arg} ¯\\_(ツ)_/¯`.trim();
    case '/tableflip':
      return `${arg} (╯°□°)╯︵ ┻━┻`.trim();
    case '/unflip':
      return `${arg} ┬─┬ ノ( ゜-゜ノ)`.trim();
    case '/lenny':
      return `${arg} ( ͡° ͜ʖ ͡°)`.trim();
    case '/me':
      return arg ? `*${arg}*` : text;
    case '/spoiler':
      return arg ? `||${arg}||` : text;
    default:
      return text;
  }
}

export default function Composer({ channelId, dmId, placeholder, canSend = true }: ComposerProps) {
  const key = channelId ?? dmId ?? '';
  const me = useAuthStore((s) => s.user);
  const reply = useMessageStore((s) => s.replyingTo[key]);
  const [value, setValue] = useState(() => useUIStore.getState().getDraft(key));
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<PendingUrl[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifUrl, setGifUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  // Sync draft + reset on channel switch.
  useEffect(() => {
    setValue(useUIStore.getState().getDraft(key));
    setFiles([]);
    setUrls([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [key]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const slashMatch = /^\/(\w*)$/.exec(value);
  const slashSuggestions = slashMatch ? SLASH_COMMANDS.filter((c) => c.name.startsWith(slashMatch[1].toLowerCase())) : [];

  function handleChange(v: string) {
    setValue(v);
    useUIStore.getState().setDraft(key, v);
    const now = Date.now();
    if (now - lastTyping.current > 2500 && v.trim()) {
      lastTyping.current = now;
      emit(SocketEvents.TYPING_START, channelId ? { channelId } : { dmChannelId: dmId });
    }
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      handleChange(value + emoji);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    handleChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    });
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list).slice(0, 10);
    setFiles((prev) => [...prev, ...arr].slice(0, 10));
  }

  function addGif() {
    const url = gifUrl.trim();
    if (!url) return;
    setUrls((prev) => [...prev, { url, filename: 'image.gif', mimeType: 'image/gif', size: 0 }]);
    setGifUrl('');
    setShowGif(false);
  }

  async function send() {
    if (sending) return;
    const raw = value.trim();
    if (!raw && files.length === 0 && urls.length === 0) return;
    if (!me) return;

    setSending(true);
    let attachments: PendingUrl[] = [...urls];
    try {
      if (files.length) {
        const { items } = await api.uploads.files(files);
        attachments = [...attachments, ...items];
      }
    } catch (err) {
      toast.error('Upload failed', (err as Error).message);
      setSending(false);
      return;
    }

    const content = applySlash(raw);
    const nonce = crypto.randomUUID();
    const optimistic: ClientMessage = {
      id: `temp_${nonce}`,
      channelId: channelId ?? null,
      dmChannelId: dmId ?? null,
      authorId: me.id,
      author: me,
      content,
      type: 'DEFAULT',
      createdAt: new Date().toISOString(),
      editedAt: null,
      pinned: false,
      replyToId: reply?.id ?? null,
      replyTo: reply ? { id: reply.id, authorId: '', authorName: reply.authorName, content: reply.content } : null,
      attachments: attachments.map((a, i) => ({ id: `tmp_${i}`, url: a.url, filename: a.filename, mimeType: a.mimeType, size: a.size, width: null, height: null })),
      reactions: [],
      pending: true,
      nonce,
    };

    useMessageStore.getState().addOptimistic(key, optimistic);
    setValue('');
    setFiles([]);
    setUrls([]);
    useUIStore.getState().setDraft(key, '');
    useMessageStore.getState().setReplyingTo(key, null);
    setShowEmoji(false);

    try {
      await emitAck(SocketEvents.MESSAGE_CREATE, {
        channelId,
        dmChannelId: dmId,
        content,
        replyToId: reply?.id ?? null,
        attachments,
        nonce,
      });
    } catch (err) {
      useMessageStore.getState().markFailed(key, nonce);
      toast.error('Message failed', (err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (slashSuggestions.length && slashMatch && slashMatch[1] !== slashSuggestions[0].name) {
        handleChange(`/${slashSuggestions[0].name} `);
        return;
      }
      void send();
    }
    if (e.key === 'Escape' && reply) useMessageStore.getState().setReplyingTo(key, null);
    if (e.key === 'Tab' && slashSuggestions.length) {
      e.preventDefault();
      handleChange(`/${slashSuggestions[0].name} `);
    }
  }

  if (!canSend) {
    return (
      <div className="px-4 pb-6 pt-2">
        <div className="rounded-2xl border border-line/60 bg-surface-2/50 px-4 py-3 text-center text-sm text-muted">You do not have permission to send messages here.</div>
      </div>
    );
  }

  return (
    <div className="relative px-4 pb-6 pt-1">
      {/* Reply banner */}
      <AnimatePresence>
        {reply && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center justify-between rounded-t-xl border border-b-0 border-line/60 bg-surface-2/70 px-4 py-1.5 text-sm"
          >
            <span className="flex items-center gap-1.5 text-muted">
              <Reply size={14} /> Replying to <span className="font-semibold text-content">{reply.authorName}</span>
            </span>
            <button onClick={() => useMessageStore.getState().setReplyingTo(key, null)} className="rounded p-0.5 text-faint hover:text-content">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slash suggestions */}
      <AnimatePresence>
        {slashSuggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="glass-strong absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-2xl shadow-panel">
            <div className="border-b border-line/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">Commands</div>
            {slashSuggestions.map((c) => (
              <button key={c.name} onMouseDown={(e) => { e.preventDefault(); handleChange(`/${c.name} `); }} className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-accent hover:text-white">
                <Slash size={14} />
                <span className="font-mono text-sm font-semibold">{c.hint}</span>
                <span className="ml-auto text-xs opacity-70">{c.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn('rounded-2xl border bg-surface-2/70 transition', reply ? 'rounded-t-none' : '', dragging ? 'border-accent bg-accent/10' : 'border-line/60')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
      >
        {/* Attachment previews */}
        {(files.length > 0 || urls.length > 0) && (
          <div className="flex flex-wrap gap-2 border-b border-line/50 p-3">
            {files.map((f, i) => (
              <AttachmentChip key={`f${i}`} name={f.name} size={f.size} mime={f.type} preview={isImage(f.type) ? URL.createObjectURL(f) : undefined} onRemove={() => setFiles((p) => p.filter((_, x) => x !== i))} />
            ))}
            {urls.map((u, i) => (
              <AttachmentChip key={`u${i}`} name={u.filename} size={u.size} mime={u.mimeType} preview={isImage(u.mimeType) ? u.url : undefined} onRemove={() => setUrls((p) => p.filter((_, x) => x !== i))} />
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5 p-2">
          <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-content" title="Upload a file">
            <Plus size={20} />
            <input type="file" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </label>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder}
            className="max-h-[220px] min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-content outline-none placeholder:text-faint"
          />

          <div className="relative flex items-center">
            <button onClick={() => setShowGif((s) => !s)} className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-content" title="Add a GIF">
              <Gift size={19} />
            </button>
            <button onClick={() => setShowEmoji((s) => !s)} className={cn('grid h-9 w-9 place-items-center rounded-xl transition hover:bg-white/10', showEmoji ? 'text-accent' : 'text-muted hover:text-content')} title="Emoji">
              <Smile size={19} />
            </button>
            <AnimatePresence>
              {(value.trim() || files.length || urls.length) ? (
                <motion.button
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  onClick={() => void send()}
                  disabled={sending}
                  className="ml-0.5 grid h-9 w-9 place-items-center rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))' }}
                  title="Send"
                >
                  <Send size={17} />
                </motion.button>
              ) : null}
            </AnimatePresence>

            {showEmoji && (
              <div className="absolute bottom-12 right-0 z-30">
                <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
              </div>
            )}
            {showGif && (
              <div className="glass-strong absolute bottom-12 right-0 z-30 w-72 rounded-2xl p-3 shadow-panel">
                <p className="mb-2 text-xs font-semibold text-muted">Paste an image or GIF URL</p>
                <input autoFocus value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGif()} placeholder="https://…/funny.gif" className="input py-1.5 text-sm" />
                <button onClick={addGif} className="btn-primary mt-2 w-full py-1.5 text-sm">Add</button>
              </div>
            )}
          </div>
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-sm font-semibold text-accent">
            Drop files to upload
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ name, size, mime, preview, onRemove }: { name: string; size: number; mime: string; preview?: string; onRemove: () => void }) {
  const Icon = isImage(mime) ? FileImage : isVideo(mime) ? Film : FileIcon;
  return (
    <div className="group relative flex items-center gap-2 rounded-xl border border-line/60 bg-surface-3/60 p-2 pr-8">
      {preview ? <img src={preview} alt={name} className="h-12 w-12 rounded-lg object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-lg bg-surface"><Icon size={20} className="text-muted" /></div>}
      <div className="min-w-0 max-w-[140px]">
        <p className="truncate text-xs font-semibold text-content">{name}</p>
        {size > 0 && <p className="text-[11px] text-muted">{formatBytes(size)}</p>}
      </div>
      <button onClick={onRemove} className="absolute right-1.5 top-1.5 rounded-md bg-black/40 p-0.5 text-white transition hover:bg-danger" title="Remove">
        <X size={13} />
      </button>
    </div>
  );
}
