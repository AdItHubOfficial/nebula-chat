import { create } from 'zustand';
import type { PublicUser } from '@shared/types';
import { api, setAuthToken, getAuthToken, ApiError } from '@/lib/api';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  status: 'idle' | 'loading' | 'authed' | 'guest';
  error: string | null;
  init: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  register: (input: { username: string; email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: PublicUser) => void;
  patchUser: (partial: Partial<PublicUser>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getAuthToken(),
  status: 'idle',
  error: null,

  async init() {
    const token = getAuthToken();
    if (!token) {
      set({ status: 'guest' });
      return;
    }
    set({ status: 'loading' });
    try {
      const { user } = await api.auth.me();
      set({ user, token, status: 'authed' });
    } catch {
      setAuthToken(null);
      set({ user: null, token: null, status: 'guest' });
    }
  },

  async login(login, password) {
    set({ error: null });
    try {
      const { token, user } = await api.auth.login(login, password);
      setAuthToken(token);
      set({ token, user, status: 'authed', error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to sign in';
      set({ error: message });
      throw err;
    }
  },

  async register(input) {
    set({ error: null });
    try {
      const { token, user } = await api.auth.register(input);
      setAuthToken(token);
      set({ token, user, status: 'authed', error: null });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to create account';
      set({ error: message });
      throw err;
    }
  },

  logout() {
    setAuthToken(null);
    set({ user: null, token: null, status: 'guest', error: null });
  },

  setUser(user) {
    set({ user });
  },

  patchUser(partial) {
    const current = get().user;
    if (current) set({ user: { ...current, ...partial } });
  },
}));
