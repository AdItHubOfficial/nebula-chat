import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useDMStore } from '@/store/dmStore';
import { useUIStore } from '@/store/uiStore';
import DMSidebar from '@/components/dm/DMSidebar';
import FriendsPanel from '@/components/dm/FriendsPanel';
import ResizeHandle from '@/components/layout/ResizeHandle';
import ChatArea from '@/components/chat/ChatArea';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/lib/api';

export default function DMLayout() {
  const { dmId } = useParams();
  const dms = useDMStore((s) => s.dms);
  const { channelWidth, setChannelWidth } = useUIStore();
  const dm = dms.find((d) => d.id === dmId);

  useEffect(() => {
    if (dmId && !dm) {
      api.dms.get(dmId).then((r) => useDMStore.getState().upsertDM(r.dm)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmId]);

  const other = dm && !dm.isGroup ? dm.participants[0] : undefined;
  const title = dm ? (dm.isGroup ? dm.name || dm.participants.map((p) => p.displayName).join(', ') : other?.displayName ?? 'Direct Message') : '';

  return (
    <div className="flex min-w-0 flex-1">
      <div style={{ width: channelWidth }} className="shrink-0">
        <DMSidebar />
      </div>
      <ResizeHandle value={channelWidth} side="left" onChange={setChannelWidth} />

      {!dmId ? (
        <FriendsPanel />
      ) : dm ? (
        <ChatArea
          dmId={dm.id}
          title={title}
          icon={other ? <Avatar userId={other.id} name={other.displayName} src={other.avatarUrl} size={24} presence={other.presence} showPresence /> : <Users size={20} />}
          topic={dm.isGroup ? `${dm.participants.length} members` : other?.customStatus}
          canSend
          canManage={false}
          composerPlaceholder={dm.isGroup ? `Message ${title}` : `Message @${other?.username ?? ''}`}
        />
      ) : (
        <div className="grid flex-1 place-items-center text-muted">Loading conversation…</div>
      )}
    </div>
  );
}
