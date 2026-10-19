import { create } from 'zustand';
import type { Attachment } from '@team-chat/shared';

/** Which global dialog is open. One store keeps shortcuts, menus and buttons in sync. */
interface DialogsState {
  quick: boolean;
  createChannel: boolean;
  newDm: boolean;
  browse: boolean;
  shortcuts: boolean;
  prefs: boolean;
  admin: boolean;
  addPeople: string | null;
  lightbox: Attachment | null;
  sidebarOpen: boolean;
  open: (
    k: 'quick' | 'createChannel' | 'newDm' | 'browse' | 'shortcuts' | 'prefs' | 'admin',
  ) => void;
  close: (
    k: 'quick' | 'createChannel' | 'newDm' | 'browse' | 'shortcuts' | 'prefs' | 'admin',
  ) => void;
  setAddPeople: (conversationId: string | null) => void;
  setLightbox: (a: Attachment | null) => void;
  setSidebar: (open: boolean) => void;
}

export const useDialogs = create<DialogsState>((set) => ({
  quick: false,
  createChannel: false,
  newDm: false,
  browse: false,
  shortcuts: false,
  prefs: false,
  admin: false,
  addPeople: null,
  lightbox: null,
  sidebarOpen: false,
  open: (k) => set({ [k]: true }),
  close: (k) => set({ [k]: false }),
  setAddPeople: (addPeople) => set({ addPeople }),
  setLightbox: (lightbox) => set({ lightbox }),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
}));
