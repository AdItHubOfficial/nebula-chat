import { useMemo } from 'react';
import { useServerStore } from '@/store/serverStore';
import { useAuthStore } from '@/store/authStore';
import { combinePermissions, hasPermission, Permission } from '@shared/permissions';

// Compute the current user's effective permission bitfield for a server.
export function usePermissions(serverId: string | null | undefined) {
  const detail = useServerStore((s) => (serverId ? s.details[serverId] : undefined));
  const members = useServerStore((s) => (serverId ? s.members[serverId] : undefined));
  const meId = useAuthStore((s) => s.user?.id);

  const perms = useMemo(() => {
    if (!detail || !meId) return 0;
    if (detail.ownerId === meId) return Permission.ADMINISTRATOR;
    const member = members?.find((m) => m.userId === meId);
    if (!member) return 0;
    const roleIds = new Set(member.roles);
    const rolePerms = detail.roles.filter((r) => roleIds.has(r.id)).map((r) => r.permissions);
    return combinePermissions(rolePerms);
  }, [detail, members, meId]);

  return {
    perms,
    can: (permission: number) => hasPermission(perms, permission),
    isOwner: detail?.ownerId === meId,
  };
}
