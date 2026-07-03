import { Crown, ShieldCheck, Clock } from 'lucide-react';
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
  admin?: boolean;
  timedOut?: boolean;
  size?: number;
}

// Small Discord-style indicator icons shown next to a member's name.
export function RoleBadges({ owner, admin, timedOut, size = 13 }: Props) {
  if (!owner && !admin && !timedOut) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {owner && (
        <Tooltip content="Server Owner">
          <Crown size={size} className="text-[#f5b942]" fill="currentColor" strokeWidth={1.25} />
        </Tooltip>
      )}
      {admin && (
        <Tooltip content="Administrator">
          <ShieldCheck size={size} className="text-accent" />
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
