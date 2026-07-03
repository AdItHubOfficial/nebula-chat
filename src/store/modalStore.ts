import { create } from 'zustand';
import type { ReactNode } from 'react';

export type ModalType =
  | 'createServer'
  | 'joinServer'
  | 'serverSettings'
  | 'createChannel'
  | 'settings'
  | 'invite'
  | 'userProfile'
  | 'quickSwitcher'
  | 'search'
  | 'admin';

export interface ContextMenuItem {
  label?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface ModalData {
  serverId?: string;
  channelId?: string;
  categoryId?: string;
  userId?: string;
  tab?: string;
  code?: string;
}

interface ModalState {
  modal: { type: ModalType; data?: ModalData } | null;
  open: (type: ModalType, data?: ModalData) => void;
  close: () => void;

  contextMenu: { x: number; y: number; items: ContextMenuItem[] } | null;
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;

  profilePopover: { userId: string; rect: DOMRect } | null;
  openProfilePopover: (userId: string, rect: DOMRect) => void;
  closeProfilePopover: () => void;

  lightbox: { url: string; filename?: string } | null;
  openLightbox: (url: string, filename?: string) => void;
  closeLightbox: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  modal: null,
  open: (type, data) => set({ modal: { type, data }, contextMenu: null }),
  close: () => set({ modal: null }),

  contextMenu: null,
  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set({ contextMenu: null }),

  profilePopover: null,
  openProfilePopover: (userId, rect) => set({ profilePopover: { userId, rect } }),
  closeProfilePopover: () => set({ profilePopover: null }),

  lightbox: null,
  openLightbox: (url, filename) => set({ lightbox: { url, filename } }),
  closeLightbox: () => set({ lightbox: null }),
}));
