import { AnimatePresence } from 'framer-motion';
import { useModalStore } from '@/store/modalStore';
import CreateServerModal from '@/components/modals/CreateServerModal';
import JoinServerModal from '@/components/modals/JoinServerModal';
import CreateChannelModal from '@/components/modals/CreateChannelModal';
import InviteModal from '@/components/modals/InviteModal';
import UserProfileModal from '@/components/modals/UserProfileModal';
import SettingsModal from '@/components/modals/SettingsModal';
import ServerSettingsModal from '@/components/modals/ServerSettingsModal';
import QuickSwitcher from '@/components/modals/QuickSwitcher';
import SearchModal from '@/components/modals/SearchModal';

export default function ModalRoot() {
  const modal = useModalStore((s) => s.modal);
  const close = useModalStore((s) => s.close);
  const data = modal?.data;

  return (
    <AnimatePresence>
      {modal?.type === 'createServer' && <CreateServerModal key="createServer" onClose={close} />}
      {modal?.type === 'joinServer' && <JoinServerModal key="joinServer" onClose={close} />}
      {modal?.type === 'createChannel' && data?.serverId && <CreateChannelModal key="createChannel" serverId={data.serverId} categoryId={data.categoryId} onClose={close} />}
      {modal?.type === 'invite' && data?.serverId && <InviteModal key="invite" serverId={data.serverId} onClose={close} />}
      {modal?.type === 'userProfile' && data?.userId && <UserProfileModal key="userProfile" userId={data.userId} onClose={close} />}
      {modal?.type === 'settings' && <SettingsModal key="settings" onClose={close} tab={data?.tab} />}
      {modal?.type === 'serverSettings' && data?.serverId && <ServerSettingsModal key="serverSettings" serverId={data.serverId} onClose={close} tab={data?.tab} />}
      {modal?.type === 'quickSwitcher' && <QuickSwitcher key="quickSwitcher" onClose={close} />}
      {modal?.type === 'search' && <SearchModal key="search" onClose={close} serverId={data?.serverId} />}
    </AnimatePresence>
  );
}
