import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings2,
  Shield,
  Users,
  Link2,
  Ban,
  ScrollText,
  Trash2,
  Plus,
  Copy,
  UserX,
  Clock,
  Loader2,
  ImagePlus,
  Check,
} from 'lucide-react';
import type { ServerDetail, Member, Role, AuditEntry, Invite, PublicUser } from '@shared/types';
import { Permission, PERMISSION_LABELS, type PermissionKey } from '@shared/permissions';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { useServerStore } from '@/store/serverStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { relativeTime, fullTimestamp } from '@/lib/time';

type TabId = 'overview' | 'roles' | 'members' | 'invites' | 'bans' | 'audit' | 'delete';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Settings2;
  danger?: boolean;
}

const PERMISSION_ENTRIES = Object.entries(Permission) as [PermissionKey, number][];

// ---------------------------------------------------------------------------
// Small inline building blocks
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-surface-3',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

function PermissionRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition hover:bg-white/5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-content">{label}</div>
        {description && <div className="truncate text-xs text-faint">{description}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-base font-bold text-content">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line/60 px-4 py-10 text-center text-sm text-faint">{children}</div>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ServerSettingsModal({
  serverId,
  onClose,
  tab,
}: {
  serverId: string;
  onClose: () => void;
  tab?: string;
}) {
  const detail = useServerStore((s) => s.details[serverId]) as ServerDetail | undefined;
  const members = useServerStore((s) => s.members[serverId]) as Member[] | undefined;
  const user = useAuthStore((s) => s.user);

  const isOwner = !!user && !!detail && user.id === detail.ownerId;

  const tabs = useMemo<TabDef[]>(() => {
    const base: TabDef[] = [
      { id: 'overview', label: 'Overview', icon: Settings2 },
      { id: 'roles', label: 'Roles', icon: Shield },
      { id: 'members', label: 'Members', icon: Users },
      { id: 'invites', label: 'Invites', icon: Link2 },
      { id: 'bans', label: 'Bans', icon: Ban },
      { id: 'audit', label: 'Audit Log', icon: ScrollText },
    ];
    if (isOwner) base.push({ id: 'delete', label: 'Delete Server', icon: Trash2, danger: true });
    return base;
  }, [isOwner]);

  const initialTab = (tabs.find((t) => t.id === tab)?.id ?? 'overview') as TabId;
  const [active, setActive] = useState<TabId>(initialTab);

  // Load data on mount.
  useEffect(() => {
    if (!useServerStore.getState().details[serverId]) {
      void useServerStore.getState().loadServer(serverId);
    }
    void useServerStore.getState().loadMembers(serverId);
  }, [serverId]);

  return (
    <Modal wide onClose={onClose} title="Server Settings" subtitle={detail?.name}>
      <div className="flex min-h-[26rem] gap-5">
        {/* Tab nav */}
        <nav className="flex w-44 shrink-0 flex-col gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? t.danger
                      ? 'bg-danger/15 text-danger'
                      : 'bg-accent/15 text-content'
                    : t.danger
                      ? 'text-danger/80 hover:bg-danger/10'
                      : 'text-muted hover:bg-white/5 hover:text-content',
                )}
              >
                <Icon size={16} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Pane */}
        <div className="min-w-0 flex-1">
          {!detail ? (
            <div className="space-y-3">
              <div className="skeleton h-8 w-1/3" />
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : active === 'overview' ? (
            <OverviewTab detail={detail} />
          ) : active === 'roles' ? (
            <RolesTab detail={detail} />
          ) : active === 'members' ? (
            <MembersTab detail={detail} members={members ?? []} />
          ) : active === 'invites' ? (
            <InvitesTab serverId={serverId} />
          ) : active === 'bans' ? (
            <BansTab serverId={serverId} />
          ) : active === 'audit' ? (
            <AuditTab serverId={serverId} />
          ) : active === 'delete' ? (
            <DeleteTab detail={detail} onClose={onClose} />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ detail }: { detail: ServerDetail }) {
  const applyServerDetail = useServerStore((s) => s.applyServerDetail);
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description ?? '');
  const [bannerColor, setBannerColor] = useState(detail.bannerColor || '#8b5cf6');
  const [iconUrl, setIconUrl] = useState<string | null>(detail.iconUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(detail.name);
    setDescription(detail.description ?? '');
    setBannerColor(detail.bannerColor || '#8b5cf6');
    setIconUrl(detail.iconUrl);
  }, [detail]);

  const dirty =
    name !== detail.name ||
    (description ?? '') !== (detail.description ?? '') ||
    bannerColor !== (detail.bannerColor || '#8b5cf6') ||
    iconUrl !== detail.iconUrl;

  async function handleIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploads.single(file);
      const { server } = await api.servers.update(detail.id, { iconUrl: url });
      applyServerDetail(server);
      setIconUrl(server.iconUrl);
      toast.success('Icon updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { server } = await api.servers.update(detail.id, {
        name: name.trim(),
        description,
        bannerColor,
      });
      applyServerDetail(server);
      toast.success('Server updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading title="Overview" subtitle="Server name, description, and appearance." />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line/60 bg-surface-2 text-faint transition hover:border-accent/60"
          style={{ backgroundImage: iconUrl ? `url(${iconUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          {uploading ? (
            <Loader2 size={22} className="animate-spin text-content" />
          ) : (
            <span className="grid place-items-center gap-1 text-[11px] opacity-0 transition group-hover:opacity-100">
              <ImagePlus size={20} />
            </span>
          )}
          {!iconUrl && !uploading && <ImagePlus size={22} className="absolute" />}
        </button>
        <div>
          <div className="text-sm font-medium text-content">Server Icon</div>
          <p className="text-xs text-muted">Recommended 512×512. Click the tile to upload.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-content">Server Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-content">Description</span>
        <textarea
          className="input min-h-[90px] resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          placeholder="What is this server about?"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-content">Banner Color</span>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={bannerColor}
            onChange={(e) => setBannerColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-line/60 bg-surface-2 p-1"
          />
          <span className="font-mono text-sm text-muted">{bannerColor}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving || !dirty || !name.trim()}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

function RolesTab({ detail }: { detail: ServerDetail }) {
  const loadServer = useServerStore((s) => s.loadServer);
  const roles = useMemo(() => [...detail.roles].sort((a, b) => b.position - a.position), [detail.roles]);

  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null);
  const selected = roles.find((r) => r.id === selectedId) ?? null;

  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [permissions, setPermissions] = useState(0);
  const [hoist, setHoist] = useState(false);
  const [mentionable, setMentionable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedId && roles[0]) setSelectedId(roles[0].id);
  }, [roles, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setColor(selected.color || '#8b5cf6');
    setPermissions(selected.permissions);
    setHoist(selected.hoist);
    setMentionable(selected.mentionable);
  }, [selected]);

  function togglePerm(bit: number, on: boolean) {
    setPermissions((p) => (on ? p | bit : p & ~bit));
  }

  async function createRole() {
    setBusy(true);
    try {
      const { role } = await api.servers.createRole(detail.id, { name: 'new role' });
      await loadServer(detail.id);
      setSelectedId(role.id);
      toast.success('Role created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create role');
    } finally {
      setBusy(false);
    }
  }

  async function saveRole() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.servers.updateRole(detail.id, selected.id, {
        name: name.trim() || selected.name,
        color,
        permissions,
        hoist,
        mentionable,
      });
      await loadServer(detail.id);
      toast.success('Role saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save role');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: Role) {
    setBusy(true);
    try {
      await api.servers.deleteRole(detail.id, role.id);
      await loadServer(detail.id);
      if (selectedId === role.id) setSelectedId(null);
      toast.success('Role deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete role');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Roles"
        subtitle="Roles define what members can do."
        action={
          <button className="btn-soft" onClick={createRole} disabled={busy}>
            <Plus size={16} /> New Role
          </button>
        }
      />

      <div className="flex gap-4">
        {/* Role list */}
        <div className="w-48 shrink-0 space-y-1">
          {roles.length === 0 && <Empty>No roles yet.</Empty>}
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                selectedId === r.id ? 'bg-white/10 text-content' : 'text-muted hover:bg-white/5',
              )}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color || 'rgb(var(--c-faint))' }} />
              <span className="truncate">{r.name}</span>
              {r.isDefault && <span className="ml-auto text-[10px] uppercase text-faint">default</span>}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="min-w-0 flex-1">
          {!selected ? (
            <Empty>Select a role to edit.</Empty>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <label className="block flex-1">
                  <span className="mb-1.5 block text-sm font-medium text-content">Role Name</span>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={selected.isDefault}
                    maxLength={60}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-content">Color</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-[42px] w-14 cursor-pointer rounded-lg border border-line/60 bg-surface-2 p-1"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2">
                  <span className="text-sm text-content">Show separately</span>
                  <Toggle checked={hoist} onChange={setHoist} />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2">
                  <span className="text-sm text-content">Mentionable</span>
                  <Toggle checked={mentionable} onChange={setMentionable} />
                </div>
              </div>

              <div>
                <div className="mb-1 text-sm font-medium text-content">Permissions</div>
                <div className="rounded-2xl border border-line/50 bg-surface-2/40 p-1">
                  {PERMISSION_ENTRIES.map(([key, bit]) => (
                    <PermissionRow
                      key={key}
                      label={PERMISSION_LABELS[key]}
                      checked={(permissions & bit) === bit}
                      onChange={(on) => togglePerm(bit, on)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="btn-ghost text-danger hover:bg-danger/10"
                  onClick={() => deleteRole(selected)}
                  disabled={selected.isDefault || busy}
                >
                  <Trash2 size={16} /> Delete Role
                </button>
                <button className="btn-primary" onClick={saveRole} disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Save Role
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function MembersTab({ detail, members }: { detail: ServerDetail; members: Member[] }) {
  const loadMembers = useServerStore((s) => s.loadMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const roleById = useMemo(() => {
    const map = new Map<string, Role>();
    detail.roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [detail.roles]);

  async function act(userId: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusyId(userId);
    try {
      await fn();
      await loadMembers(detail.id);
      toast.success(okMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading title="Members" subtitle={`${detail.memberCount} member${detail.memberCount === 1 ? '' : 's'}`} />

      {members.length === 0 ? (
        <Empty>No members loaded.</Empty>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => {
            const isServerOwner = m.userId === detail.ownerId;
            const busy = busyId === m.userId;
            const displayName = m.nickname || m.user.displayName;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2">
                <Avatar userId={m.userId} name={m.user.displayName} src={m.user.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-content">{displayName}</span>
                    {isServerOwner && <span className="chip bg-warning/20 text-warning">Owner</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {m.roles
                      .map((id) => roleById.get(id))
                      .filter((r): r is Role => !!r && !r.isDefault)
                      .map((r) => (
                        <span
                          key={r.id}
                          className="chip"
                          style={{ background: `${r.color || '#8b5cf6'}22`, color: r.color || 'rgb(var(--c-content))' }}
                        >
                          {r.name}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className="btn-ghost px-2 py-1.5 text-muted hover:text-content"
                    title="Timeout 10 minutes"
                    disabled={busy || isServerOwner}
                    onClick={() => act(m.userId, () => api.servers.timeout(detail.id, m.userId, 10), 'Member timed out')}
                  >
                    <Clock size={16} />
                  </button>
                  <button
                    className="btn-ghost px-2 py-1.5 text-muted hover:text-content"
                    title="Kick"
                    disabled={busy || isServerOwner}
                    onClick={() => act(m.userId, () => api.servers.kick(detail.id, m.userId), 'Member kicked')}
                  >
                    <UserX size={16} />
                  </button>
                  <button
                    className="btn-ghost px-2 py-1.5 text-danger hover:bg-danger/10"
                    title="Ban"
                    disabled={busy || isServerOwner}
                    onClick={() => act(m.userId, () => api.servers.ban(detail.id, m.userId), 'Member banned')}
                  >
                    <Ban size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

function InvitesTab({ serverId }: { serverId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function reload() {
    try {
      const { items } = await api.invites.list(serverId);
      setInvites(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load invites');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function create() {
    setCreating(true);
    try {
      await api.invites.create(serverId);
      await reload();
      toast.success('Invite created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create invite');
    } finally {
      setCreating(false);
    }
  }

  async function copy(code: string) {
    const link = `${location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }

  async function revoke(code: string) {
    try {
      await api.invites.remove(code);
      setInvites((list) => list.filter((i) => i.code !== code));
      toast.success('Invite revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke invite');
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Invites"
        subtitle="Share these links to let people join."
        action={
          <button className="btn-primary" onClick={create} disabled={creating}>
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Invite
          </button>
        }
      />

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ) : invites.length === 0 ? (
        <Empty>No active invites. Create one to get started.</Empty>
      ) : (
        <div className="space-y-1.5">
          {invites.map((inv) => (
            <div key={inv.code} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-sm text-content">/invite/{inv.code}</div>
                <div className="text-xs text-faint">
                  {inv.uses} use{inv.uses === 1 ? '' : 's'}
                  {inv.maxUses > 0 && ` / ${inv.maxUses}`}
                  {inv.expiresAt ? ` · expires ${relativeTime(inv.expiresAt)}` : ' · never expires'}
                </div>
              </div>
              <button className="btn-soft px-3 py-1.5" onClick={() => copy(inv.code)}>
                {copied === inv.code ? <Check size={15} /> : <Copy size={15} />}
                {copied === inv.code ? 'Copied' : 'Copy'}
              </button>
              <button className="btn-ghost px-2 py-1.5 text-danger hover:bg-danger/10" title="Revoke" onClick={() => revoke(inv.code)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

interface BanEntry {
  id: string;
  reason: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
}

function BansTab({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      const { items } = await api.servers.bans(serverId);
      setBans(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load bans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function unban(userId: string) {
    setBusyId(userId);
    try {
      await api.servers.unban(serverId, userId);
      setBans((list) => list.filter((b) => b.user.id !== userId));
      toast.success('Member unbanned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not unban');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading title="Bans" subtitle="Banned members cannot rejoin." />
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ) : bans.length === 0 ? (
        <Empty>No one is banned.</Empty>
      ) : (
        <div className="space-y-1.5">
          {bans.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2">
              <Avatar userId={b.user.id} name={b.user.displayName} src={b.user.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-content">{b.user.displayName}</div>
                <div className="truncate text-xs text-faint">{b.reason || `@${b.user.username}`}</div>
              </div>
              <button className="btn-soft px-3 py-1.5" disabled={busyId === b.user.id} onClick={() => unban(b.user.id)}>
                Unban
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

function AuditTab({ serverId }: { serverId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { items } = await api.servers.audit(serverId);
        if (alive) setEntries(items);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load audit log');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [serverId]);

  function describe(action: string) {
    return action
      .toLowerCase()
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-4">
      <SectionHeading title="Audit Log" subtitle="A record of moderation and configuration changes." />
      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <Empty>No audit entries yet.</Empty>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => {
            const actor: PublicUser = e.actor;
            return (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2">
                <Avatar userId={e.actorId} name={actor.displayName} src={actor.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-content">
                    <span className="font-medium">{actor.displayName}</span>{' '}
                    <span className="text-muted">{describe(e.action)}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-faint" title={fullTimestamp(e.createdAt)}>
                  {relativeTime(e.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Server
// ---------------------------------------------------------------------------

function DeleteTab({ detail, onClose }: { detail: ServerDetail; onClose: () => void }) {
  const removeServer = useServerStore((s) => s.removeServer);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirm.trim() === detail.name;

  async function remove() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      await api.servers.remove(detail.id);
      removeServer(detail.id);
      toast.success('Server deleted');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete server');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading title="Delete Server" subtitle="This action is permanent and cannot be undone." />
      <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4">
        <p className="text-sm text-content">
          Deleting <span className="font-semibold">{detail.name}</span> will permanently remove all of its channels,
          messages, roles, and members. This cannot be reversed.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-content">
            Type <span className="font-mono text-danger">{detail.name}</span> to confirm
          </span>
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={detail.name} />
        </label>
        <div className="mt-4 flex justify-end">
          <button className="btn-danger" onClick={remove} disabled={!canDelete || deleting}>
            {deleting && <Loader2 size={16} className="animate-spin" />}
            Delete Server
          </button>
        </div>
      </div>
    </div>
  );
}
