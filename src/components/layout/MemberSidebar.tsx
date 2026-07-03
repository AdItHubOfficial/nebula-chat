import { useMemo } from 'react';
import { useServerStore } from '@/store/serverStore';
import { useModalStore } from '@/store/modalStore';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadges, memberIsAdmin } from '@/components/ui/RoleBadges';
import { cn } from '@/lib/utils';
import type { Member, Role } from '@shared/types';

const DEFAULT_ROLE_COLOR = '#a1a1aa';

export default function MemberSidebar({ serverId }: { serverId: string }) {
  const members = useServerStore((s) => s.members[serverId]);
  const detail = useServerStore((s) => s.details[serverId]);
  const openProfilePopover = useModalStore((s) => s.openProfilePopover);

  const groups = useMemo(() => buildGroups(members ?? [], detail?.roles ?? []), [members, detail]);

  if (!members) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-3 flex-1 rounded" style={{ maxWidth: `${60 + (i % 3) * 20}%` }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-surface/50 px-2.5 py-4">
      {groups.map((group) => (
        <div key={group.key} className="mb-4">
          <h3 className="mb-1 px-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">
            {group.label} — {group.members.length}
          </h3>
          <div className="space-y-0.5">
            {group.members.map((m) => (
              <MemberRow key={m.id} member={m} roles={detail?.roles ?? []} ownerId={detail?.ownerId} onClick={(rect) => openProfilePopover(m.userId, rect)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberRow({ member, roles, ownerId, onClick }: { member: Member; roles: Role[]; ownerId?: string; onClick: (rect: DOMRect) => void }) {
  const color = topColor(member, roles);
  const offline = !member.user.online;
  const isOwner = !!ownerId && member.userId === ownerId;
  const isAdmin = isOwner || memberIsAdmin(member, roles) || member.user.adminBadge;
  const timedOut = !!member.timeoutUntil && new Date(member.timeoutUntil) > new Date();
  return (
    <button
      onClick={(e) => onClick((e.currentTarget as HTMLElement).getBoundingClientRect())}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/5', offline && 'opacity-40 hover:opacity-100')}
    >
      <Avatar userId={member.userId} name={member.user.displayName} src={member.user.avatarUrl} size={32} presence={member.user.presence} showPresence />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold" style={{ color: color ?? 'rgb(var(--c-text))' }}>
            {member.nickname || member.user.displayName}
          </span>
          <RoleBadges owner={isOwner} admin={isAdmin} verified={member.user.verified} og={member.user.og} timedOut={timedOut} />
        </div>
        {member.user.customStatus && <div className="truncate text-[11px] text-muted">{member.user.customStatus}</div>}
      </div>
    </button>
  );
}

interface Group {
  key: string;
  label: string;
  members: Member[];
}

function buildGroups(members: Member[], roles: Role[]): Group[] {
  const hoistRoles = roles.filter((r) => r.hoist).sort((a, b) => b.position - a.position);
  const online = members.filter((m) => m.user.online);
  const offline = members.filter((m) => !m.user.online);

  const groups: Group[] = [];
  const claimed = new Set<string>();

  for (const role of hoistRoles) {
    const roleMembers = online.filter((m) => !claimed.has(m.id) && topHoistRoleId(m, hoistRoles) === role.id);
    if (roleMembers.length) {
      roleMembers.forEach((m) => claimed.add(m.id));
      groups.push({ key: role.id, label: role.name.replace('@', ''), members: sortByName(roleMembers) });
    }
  }

  const restOnline = online.filter((m) => !claimed.has(m.id));
  if (restOnline.length) groups.push({ key: 'online', label: 'Online', members: sortByName(restOnline) });
  if (offline.length) groups.push({ key: 'offline', label: 'Offline', members: sortByName(offline) });
  return groups;
}

function topHoistRoleId(member: Member, hoistRoles: Role[]): string | null {
  const set = new Set(member.roles);
  for (const r of hoistRoles) if (set.has(r.id)) return r.id;
  return null;
}

function topColor(member: Member, roles: Role[]): string | null {
  const memberRoles = roles.filter((r) => member.roles.includes(r.id) && r.color !== DEFAULT_ROLE_COLOR && !r.isDefault).sort((a, b) => b.position - a.position);
  return memberRoles[0]?.color ?? null;
}

function sortByName(members: Member[]): Member[] {
  return [...members].sort((a, b) => (a.nickname || a.user.displayName).localeCompare(b.nickname || b.user.displayName));
}
