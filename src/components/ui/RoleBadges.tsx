import { Crown, ShieldCheck, Clock, BadgeCheck } from 'lucide-react';
import Tooltip from './Tooltip';
import { combinePermissions, hasPermission, Permission } from '@shared/permissions';
import type { Member, Role } from '@shared/types';

// Does a member have the Administrator permission through any of their roles?
export function memberIsAdmin(member: Member, roles: Role[]): boolean {
  const ids = new Set(member.roles);
  const perms = combinePermissions(roles.filter((r) => ids.has(r.id)).map((r) => r.permissions));
  return hasPermission(perms, Permission.ADMINISTRATOR);
}

interface Props {
  owner?: boolean;
  coOwner?: boolean;
  admin?: boolean;
  verified?: boolean;
  og?: boolean;
  timedOut?: boolean;
  size?: number;
}

// Small Discord-style indicator icons shown next to a member's name.
export function RoleBadges({ owner, coOwner, admin, verified, og, timedOut, size = 13 }: Props) {
  if (!owner && !coOwner && !admin && !verified && !og && !timedOut) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {owner && (
        <Tooltip content="Server Owner">
          <Crown size={size} className="text-[#f5b942]" fill="currentColor" strokeWidth={1.25} />
        </Tooltip>
      )}
      {coOwner && !owner && (
        <Tooltip content="Co-Owner">
          <Crown size={size} className="text-[#9fb3c8]" fill="currentColor" strokeWidth={1.25} />
        </Tooltip>
      )}
      {admin && (
        <Tooltip content="Administrator">
          <ShieldCheck size={size} className="text-accent" />
        </Tooltip>
      )}
      {verified && (
        <Tooltip content="Verified">
          <BadgeCheck size={size + 1} className="text-[#3b9dff]" strokeWidth={2.25} />
        </Tooltip>
      )}
      {og && (
        <Tooltip content="OG — original member">
          <span
            className="grid place-items-center rounded px-1 font-black leading-none text-white"
            style={{ height: size + 1, fontSize: size - 4, background: 'linear-gradient(135deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))' }}
          >
            OG
          </span>
        </Tooltip>
      )}
      {timedOut && (
        <Tooltip content="Timed out">
          <Clock size={size} className="text-danger" />
        </Tooltip>
      )}
    </span>
  );
}
