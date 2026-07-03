// Permission bitfield shared between client and server.
// A member's effective permissions is the OR of all their roles' permission ints.

export const Permission = {
  VIEW_CHANNELS: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  MANAGE_CHANNELS: 1 << 3,
  MANAGE_ROLES: 1 << 4,
  KICK_MEMBERS: 1 << 5,
  BAN_MEMBERS: 1 << 6,
  TIMEOUT_MEMBERS: 1 << 7,
  MANAGE_SERVER: 1 << 8,
  CREATE_INVITE: 1 << 9,
  MENTION_EVERYONE: 1 << 10,
  MANAGE_EMOJIS: 1 << 11,
  VIEW_AUDIT_LOG: 1 << 12,
  CONNECT_VOICE: 1 << 13,
  ADMINISTRATOR: 1 << 20,
} as const;

export type PermissionKey = keyof typeof Permission;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  VIEW_CHANNELS: 'View Channels',
  SEND_MESSAGES: 'Send Messages',
  MANAGE_MESSAGES: 'Manage Messages',
  MANAGE_CHANNELS: 'Manage Channels',
  MANAGE_ROLES: 'Manage Roles',
  KICK_MEMBERS: 'Kick Members',
  BAN_MEMBERS: 'Ban Members',
  TIMEOUT_MEMBERS: 'Timeout Members',
  MANAGE_SERVER: 'Manage Server',
  CREATE_INVITE: 'Create Invite',
  MENTION_EVERYONE: 'Mention Everyone',
  MANAGE_EMOJIS: 'Manage Emojis',
  VIEW_AUDIT_LOG: 'View Audit Log',
  CONNECT_VOICE: 'Connect to Voice',
  ADMINISTRATOR: 'Administrator',
};

// Default permissions granted to the @everyone role.
export const DEFAULT_PERMISSIONS =
  Permission.VIEW_CHANNELS |
  Permission.SEND_MESSAGES |
  Permission.CREATE_INVITE |
  Permission.CONNECT_VOICE;

// Full permission mask (Administrator implies all).
export const ALL_PERMISSIONS = Object.values(Permission).reduce((a, b) => a | b, 0);

export function hasPermission(bitfield: number, permission: number): boolean {
  if ((bitfield & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (bitfield & permission) === permission;
}

export function combinePermissions(perms: number[]): number {
  return perms.reduce((a, b) => a | b, 0);
}
