import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import ServerRail from '@/components/layout/ServerRail';
import ServerLayout from './ServerLayout';
import DMLayout from './DMLayout';
import Toasts from '@/components/ui/Toasts';
import ContextMenu from '@/components/ui/ContextMenu';
import ModalRoot from '@/components/overlays/ModalRoot';
import ProfilePopover from '@/components/overlays/ProfilePopover';
import Lightbox from '@/components/overlays/Lightbox';
import IncomingCallModal from '@/components/voice/IncomingCallModal';
import { initRealtime, teardownRealtime, requestNotificationPermission } from '@/services/realtime';
import { disconnectSocket } from '@/lib/socket';
import { useServerStore } from '@/store/serverStore';
import { useDMStore } from '@/store/dmStore';
import { useFriendStore } from '@/store/friendStore';
import { useUIStore } from '@/store/uiStore';
import { useModalStore } from '@/store/modalStore';
import { toast } from '@/store/toastStore';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Connect realtime + hydrate core data.
  useEffect(() => {
    initRealtime();
    void useServerStore.getState().loadServers();
    void useDMStore.getState().loadDMs();
    void useFriendStore.getState().load();
    requestNotificationPermission();
    return () => {
      disconnectSocket();
      teardownRealtime();
    };
  }, []);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useModalStore.getState().open('quickSwitcher');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Redirect home if the current server is deleted / we're removed from it.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { serverId: string };
      if (location.pathname.startsWith(`/channels/${detail.serverId}`)) {
        toast.info('You are no longer in this server');
        navigate('/channels/@me');
      }
    };
    window.addEventListener('nebula:server-removed', handler);
    return () => window.removeEventListener('nebula:server-removed', handler);
  }, [location.pathname, navigate]);

  return (
    <div className="app-gradient flex h-full w-full overflow-hidden">
      <ServerRail />
      <main className="flex min-w-0 flex-1">
        <Routes>
          <Route path="@me" element={<DMLayout />} />
          <Route path="@me/:dmId" element={<DMLayout />} />
          <Route path=":serverId" element={<ServerLayout />} />
          <Route path=":serverId/:channelId" element={<ServerLayout />} />
          <Route path="*" element={<Navigate to="@me" replace />} />
        </Routes>
      </main>

      {/* Global overlays */}
      <Toasts />
      <ContextMenu />
      <ModalRoot />
      <ProfilePopover />
      <Lightbox />
      <IncomingCallModal />
    </div>
  );
}
