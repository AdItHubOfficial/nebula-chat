import { create } from 'zustand';
import type { Toast } from '@/types';

let counter = 0;

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(t) {
    const id = `t${Date.now()}_${counter++}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4200);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
}));

export const toast = {
  info: (title: string, description?: string) => useToastStore.getState().push({ type: 'info', title, description }),
  success: (title: string, description?: string) => useToastStore.getState().push({ type: 'success', title, description }),
  error: (title: string, description?: string) => useToastStore.getState().push({ type: 'error', title, description }),
};
