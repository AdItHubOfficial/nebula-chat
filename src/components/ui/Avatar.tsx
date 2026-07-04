import { memo } from 'react';
import type { PresenceState } from '@shared/types';
import { cn, gradientFor, initials } from '@/lib/utils';

interface AvatarProps {
  userId: string;
  name: string;
  src?: string | null;
  size?: number;
  presence?: PresenceState;
  showPresence?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const PRESENCE_COLORS: Record<PresenceState, string> = {
  ONLINE: 'rgb(var(--c-success))',
  IDLE: 'rgb(var(--c-idle))',
  DND: 'rgb(var(--c-danger))',
  INVISIBLE: 'rgb(var(--c-faint))',
  OFFLINE: 'rgb(var(--c-faint))',
};

function AvatarBase({ userId, name, src, size = 40, presence, showPresence, className, onClick, onContextMenu }: AvatarProps) {
  const [from, to] = gradientFor(userId);
  const dot = Math.max(10, Math.round(size * 0.32));
  return (
    <div className={cn('relative shrink-0 select-none', onClick && 'cursor-pointer')} style={{ width: size, height: size }} onClick={onClick} onContextMenu={onContextMenu}>
      {src ? (
        <img src={src} alt={name} className={cn('h-full w-full rounded-full object-cover', className)} draggable={false} />
      ) : (
        <div
          className={cn('grid h-full w-full place-items-center rounded-full font-semibold text-white', className)}
          style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})`, fontSize: size * 0.4 }}
        >
          {initials(name)}
        </div>
      )}
      {showPresence && presence && (
        <span
          className="absolute rounded-full border-[3px] border-surface"
          style={{
            width: dot,
            height: dot,
            right: -1,
            bottom: -1,
            background: PRESENCE_COLORS[presence],
            borderColor: 'rgb(var(--c-surface))',
          }}
        >
          {presence === 'IDLE' && <span className="absolute rounded-full bg-surface" style={{ width: dot * 0.5, height: dot * 0.5, top: 0, right: 0 }} />}
          {presence === 'DND' && <span className="absolute rounded-full bg-white" style={{ width: dot * 0.55, height: dot * 0.18, top: '41%', left: '22%' }} />}
        </span>
      )}
    </div>
  );
}

export const Avatar = memo(AvatarBase);
