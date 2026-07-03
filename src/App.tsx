import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { sounds } from './lib/sounds';
import LoadingScreen from './components/ui/LoadingScreen';
import AuthPage from './pages/AuthPage';
import InvitePage from './pages/InvitePage';
import AppLayout from './pages/AppLayout';

function RequireAuth({ children }: { children: JSX.Element }) {
  const status = useAuthStore((s) => s.status);
  if (status !== 'authed') return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }: { children: JSX.Element }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'authed') return <Navigate to="/channels/@me" replace />;
  return children;
}

export default function App() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void useAuthStore.getState().init();
  }, []);

  useEffect(() => {
    const unlock = () => {
      sounds.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (status === 'idle' || status === 'loading') return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/channels/*" element={<RequireAuth><AppLayout /></RequireAuth>} />
      <Route path="*" element={<Navigate to={status === 'authed' ? '/channels/@me' : '/login'} replace />} />
    </Routes>
  );
}
