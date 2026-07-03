import { useServerStore } from '@/store/serverStore';
import { memberIsAdmin } from '@/components/ui/RoleBadges';

// Compute a user's owner / administrator badge flags from loaded server data.
// A server owner is treated as an administrator too.
export function useUserBadges(userId: string | undefined): { owner: boolean; admin: boolean } {
  const servers = useServerStore((s) => s.servers);
  const details = useServerStore((s) => s.details);
  const members = useServerStore((s) => s.members);

  if (!userId) return { owner: false, admin: false };

  const owner = servers.some((sv) => sv.ownerId === userId);
  let admin = owner;
  if (!admin) {
    for (const [serverId, detail] of Object.entries(details)) {
      const member = members[serverId]?.find((m) => m.userId === userId);
      if (member && memberIsAdmin(member, detail.roles)) {
        admin = true;
        break;
      }
    }
  }
  return { owner, admin };
}
