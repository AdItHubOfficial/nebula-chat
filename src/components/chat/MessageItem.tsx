import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Smile, Reply, Pencil, Trash2, Pin, MoreHorizontal, Check, X, CornerUpRight, AlertCircle } from 'lucide-react';
import type { ClientMessage } from '@/store/messageStore';
import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { useModalStore } from '@/store/modalStore';
import { emit } from '@/lib/socket';
import { SocketEvents } from '@shared/events';
import { renderMarkdown, isJumbo } from '@/lib/markdown';
import { messageTime, groupTimestamp } from '@/lib/time';
import { cn, formatBytes, isImage, isVideo, isAudio } from '@/lib/utils';
import { QUICK_REACTIONS } from '@shared/emoji';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges } from '@/components/ui/RoleBadges';
import Tooltip from '@/components/ui/Tooltip';
import EmojiPicker from './EmojiPicker';
import type { Attachment, ReactionGroup } from '@shared/types';

interface Props {
  message: ClientMessage;
  grouped: boolean;
  convoKey: string;
  canManage: boolean;
  ownerId?: string;
}

function MessageItemBase({ message, grouped, convoKey, canManage, ownerId }: Props) {
  const me = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [pickerOpen, setPickerOpen] = useState(false);
  const openProfile = useModalStore((s) => s.openProfilePopover);
  const openContextMenu = useModalStore((s) => s.openContextMenu);

  const isMine = message.authorId === me?.id;
  const jumbo = !message.attachments.length && isJumbo(message.content);
  const isSystem = message.type === 'SYSTEM';

  function toggleReaction(emoji: string) {
    if (!me) return;
    const group = message.reactions.find((r) => r.emoji === emoji);
    const add = !group?.me;
    useMessageStore.getState().applyReaction(message.id, emoji, me.id, add);
    emit(add ? SocketEvents.REACTION_ADD : SocketEvents.REACTION_REMOVE, { messageId: message.id, emoji });
  }

  function reply() {
    useMessageStore.getState().setReplyingTo(convoKey, { id: message.id, authorName: message.author.displayName, content: message.content });
  }

  function saveEdit() {
    const v = editValue.trim();
    if (v && v !== message.content) emit(SocketEvents.MESSAGE_UPDATE, { messageId: message.id, content: v });
    setEditing(false);
  }

  function del() {
    if (confirm('Delete this message?')) emit(SocketEvents.MESSAGE_DELETE, { messageId: message.id });
  }

  function togglePin() {
    emit(SocketEvents.MESSAGE_PIN, { messageId: message.id, pinned: !message.pinned });
  }

  function moreMenu(e: React.MouseEvent) {
    openContextMenu(e.clientX, e.clientY, [
      { label: 'Add Reaction', icon: <Smile size={15} />, onClick: () => setPickerOpen(true) },
      { label: 'Reply', icon: <Reply size={15} />, onClick: reply },
      ...(canManage ? [{ label: message.pinned ? 'Unpin Message' : 'Pin Message', icon: <Pin size={15} />, onClick: togglePin }] : []),
      { label: 'Copy Text', icon: <CornerUpRight size={15} />, onClick: () => void navigator.clipboard.writeText(message.content) },
      ...(isMine ? [{ label: 'Edit', icon: <Pencil size={15} />, onClick: () => setEditing(true) }] : []),
      ...(isMine || canManage ? [{ separator: true }, { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: del }] : []),
    ]);
  }

  return (
    <div
      className={cn('group relative flex gap-3 px-4 transition-colors hover:bg-white/[0.03]', grouped ? 'mt-0.5 py-0.5' : 'mt-3 py-0.5', message.pinned && 'bg-warning/[0.06]')}
    >
      {/* Left gutter: avatar or hover-time */}
      <div className="w-10 shrink-0">
        {!grouped ? (
          <Avatar
            userId={message.authorId}
            name={message.author.displayName}
            src={message.author.avatarUrl}
            size={40}
            className="mt-0.5 cursor-pointer transition hover:opacity-90"
            onClick={(e) => openProfile(message.authorId, (e.currentTarget as HTMLElement).getBoundingClientRect())}
          />
        ) : (
          <span className="mt-1 hidden select-none text-[10px] leading-5 text-faint tabular-nums group-hover:block">{messageTime(message.createdAt)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Reply reference */}
        {message.replyTo && (
          <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span className="ml-[-8px] mt-1 h-2 w-4 rounded-tl-md border-l-2 border-t-2 border-line/70" />
            <Reply size={11} className="rotate-180" />
            <span className="font-semibold text-content/80">{message.replyTo.authorName}</span>
            <span className="truncate opacity-80">{message.replyTo.content || 'Click to see attachment'}</span>
          </div>
        )}

        {!grouped && (
          <div className="flex items-baseline gap-2">
            <button onClick={(e) => openProfile(message.authorId, (e.currentTarget as HTMLElement).getBoundingClientRect())} className="font-semibold text-content hover:underline" style={{ color: message.author.accentColor }}>
              {message.author.displayName}
            </button>
            <RoleBadges owner={!!ownerId && message.authorId === ownerId} size={14} />
            <Tooltip content={groupTimestamp(message.createdAt)} side="top">
              <span className="text-[11px] text-faint">{groupTimestamp(message.createdAt)}</span>
            </Tooltip>
          </div>
        )}

        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="input min-h-[40px] resize-none"
            />
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
              <span>escape to <button onClick={() => setEditing(false)} className="text-accent hover:underline">cancel</button> · enter to <button onClick={saveEdit} className="text-accent hover:underline">save</button></span>
            </div>
          </div>
        ) : (
          <>
            {isSystem ? (
              <p className="text-sm italic text-muted">{message.content}</p>
            ) : (
              message.content && (
                <div
                  className={cn('prose-chat text-content', jumbo && 'text-[2.6rem] leading-tight', message.pending && 'opacity-60')}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                />
              )
            )}
            {message.editedAt && !message.pending && <span className="ml-1 text-[10px] text-faint">(edited)</span>}
            {message.failed && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-danger"><AlertCircle size={13} /> Failed to send</div>
            )}

            {message.attachments.length > 0 && <Attachments attachments={message.attachments} />}
            {message.reactions.length > 0 && <Reactions reactions={message.reactions} onToggle={toggleReaction} />}
          </>
        )}
      </div>

      {/* Hover toolbar */}
      {!editing && (
        <div className="absolute -top-3.5 right-4 z-10 hidden items-center gap-0.5 rounded-xl border border-line/60 bg-surface-2 p-0.5 shadow-card group-hover:flex">
          <div className="relative">
            <ToolbarBtn label="React" onClick={() => setPickerOpen((s) => !s)}><Smile size={16} /></ToolbarBtn>
            <AnimatePresence>
              {pickerOpen && (
                <div className="absolute bottom-10 right-0 z-40">
                  <EmojiPicker onSelect={(e) => { toggleReaction(e); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />
                </div>
              )}
            </AnimatePresence>
          </div>
          <ToolbarBtn label="Reply" onClick={reply}><Reply size={16} /></ToolbarBtn>
          {isMine && <ToolbarBtn label="Edit" onClick={() => { setEditValue(message.content); setEditing(true); }}><Pencil size={16} /></ToolbarBtn>}
          {canManage && <ToolbarBtn label={message.pinned ? 'Unpin' : 'Pin'} onClick={togglePin}><Pin size={16} /></ToolbarBtn>}
          <ToolbarBtn label="More" onClick={moreMenu}><MoreHorizontal size={16} /></ToolbarBtn>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <Tooltip content={label}>
      <button onClick={onClick} className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-content">{children}</button>
    </Tooltip>
  );
}

function Reactions({ reactions, onToggle }: { reactions: ReactionGroup[]; onToggle: (emoji: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {reactions.map((r) => (
        <motion.button
          key={r.emoji}
          layout
          whileTap={{ scale: 0.9 }}
          onClick={() => onToggle(r.emoji)}
          className={cn('flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-sm transition', r.me ? 'border-accent/70 bg-accent/20' : 'border-line/60 bg-surface-3/50 hover:border-line')}
        >
          <span>{r.emoji}</span>
          <span className={cn('text-xs font-semibold tabular-nums', r.me ? 'text-accent' : 'text-muted')}>{r.count}</span>
        </motion.button>
      ))}
    </div>
  );
}

function Attachments({ attachments }: { attachments: Attachment[] }) {
  const openLightbox = useModalStore((s) => s.openLightbox);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => {
        if (isImage(a.mimeType)) {
          return <img key={a.id} src={a.url} alt={a.filename} onClick={() => openLightbox(a.url, a.filename)} className="max-h-80 max-w-md cursor-pointer rounded-xl border border-line/50 object-cover transition hover:brightness-110" loading="lazy" />;
        }
        if (isVideo(a.mimeType)) {
          return <video key={a.id} src={a.url} controls className="max-h-80 max-w-md rounded-xl border border-line/50" />;
        }
        if (isAudio(a.mimeType)) {
          return <audio key={a.id} src={a.url} controls className="w-72" />;
        }
        return (
          <a key={a.id} href={a.url} download={a.filename} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-line/60 bg-surface-2/60 p-3 transition hover:border-accent/60">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">📎</div>
            <div>
              <p className="text-sm font-semibold text-accent">{a.filename}</p>
              <p className="text-xs text-muted">{formatBytes(a.size)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export const MessageItem = memo(MessageItemBase);
