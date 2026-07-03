import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Hash, Volume2, Megaphone } from 'lucide-react';
import { useServerStore } from '@/store/serverStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@shared/permissions';
import ChannelSidebar from '@/components/layout/ChannelSidebar';
import MemberSidebar from '@/components/layout/MemberSidebar';
import ResizeHandle from '@/components/layout/ResizeHandle';
import ChatArea from '@/components/chat/ChatArea';
import VoicePanel from '@/components/voice/VoicePanel';
import LoadingScreen from '@/components/ui/LoadingScreen';

const ICONS = { TEXT: Hash, VOICE: Volume2, ANNOUNCEMENT: Megaphone };

export default function ServerLayout() {
  const { serverId = '', channelId } = useParams();
  const navigate = useNavigate();
  const detail = useServerStore((s) => s.details[serverId]);
  const servers = useServerStore((s) => s.servers);
  const { channelWidth, memberWidth, memberListOpen, setChannelWidth, setMemberWidth, toggleMemberList, setLastServer, setLastChannel, lastChannelByServer } = useUIStore();
  const meId = useAuthStore((s) => s.user?.id);
  const { can } = usePermissions(serverId);
  const members = useServerStore((s) => s.members[serverId]);
  const [notFound, setNotFound] = useState(false);

  // Load server data.
  useEffect(() => {
    if (!serverId) return;
    setNotFound(false);
    setLastServer(serverId);
    const store = useServerStore.getState();
    if (!store.details[serverId]) {
      store.loadServer(serverId).then((s) => { if (!s) setNotFound(true); });
    }
    store.loadMembers(serverId).catch(() => {});
    store.loadEmojis(serverId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  useEffect(() => {
    if (channelId && serverId) setLastChannel(serverId, channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, serverId]);

  if (notFound) return <Navigate to="/channels/@me" replace />;
  if (!detail) return <div className="flex min-w-0 flex-1"><LoadingScreen label="Loading server…" /></div>;

  // Redirect to a sensible default channel.
  if (!channelId) {
    const preferred = lastChannelByServer[serverId];
    const target =
      detail.channels.find((c) => c.id === preferred && c.type !== 'VOICE') ??
      detail.channels.find((c) => c.type === 'TEXT' || c.type === 'ANNOUNCEMENT') ??
      detail.channels[0];
    if (target) return <Navigate to={`/channels/${serverId}/${target.id}`} replace />;
  }

  const activeChannel = detail.channels.find((c) => c.id === channelId);
  if (channelId && !activeChannel && detail.channels.length) {
    const fallback = detail.channels.find((c) => c.type !== 'VOICE') ?? detail.channels[0];
    return <Navigate to={`/channels/${serverId}/${fallback.id}`} replace />;
  }

  const myMember = members?.find((m) => m.userId === meId);
  const timedOut = !!myMember?.timeoutUntil && new Date(myMember.timeoutUntil) > new Date();
  const canSend = activeChannel ? can(Permission.SEND_MESSAGES) && !timedOut : false;
  const canManage = can(Permission.MANAGE_MESSAGES);
  const Icon = activeChannel ? ICONS[activeChannel.type] ?? Hash : Hash;

  return (
    <div className="flex min-w-0 flex-1">
      <div style={{ width: channelWidth }} className="shrink-0">
        <ChannelSidebar serverId={serverId} />
      </div>
      <ResizeHandle value={channelWidth} side="left" onChange={setChannelWidth} />

      {activeChannel ? (
        activeChannel.type === 'VOICE' ? (
          <VoicePanel channel={activeChannel} />
        ) : (
          <ChatArea
            channelId={activeChannel.id}
            serverId={serverId}
            title={activeChannel.name}
            icon={<Icon size={20} />}
            topic={activeChannel.topic}
            canSend={canSend}
            canManage={canManage}
            composerPlaceholder={`Message #${activeChannel.name}`}
            membersOpen={memberListOpen}
            onToggleMembers={toggleMemberList}
          />
        )
      ) : (
        <div className="grid flex-1 place-items-center text-muted">No channels yet.</div>
      )}

      {memberListOpen && (
        <>
          <ResizeHandle value={memberWidth} side="right" onChange={setMemberWidth} />
          <div style={{ width: memberWidth }} className="shrink-0">
            <MemberSidebar serverId={serverId} />
          </div>
        </>
      )}
    </div>
  );
}
