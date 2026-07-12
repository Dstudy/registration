'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface AuthUser {
  id: number;
  ma_tnv: string;
  fullname?: string;
  role: 'ADMIN' | 'VOLUNTEER';
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  viewAsVolunteer: boolean;
  login: (ma_tnv: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setHasHydrated: (value: boolean) => void;
  setViewAsVolunteer: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      viewAsVolunteer: false,

      login: async (ma_tnv, password) => {
        const { data } = await api.post('/auth/login', { ma_tnv, password });
        const user = data.data ?? data;
        set({ user, isAuthenticated: true, viewAsVolunteer: false });
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          set({ user: null, isAuthenticated: false, viewAsVolunteer: false });
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user, viewAsVolunteer: false }),

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setViewAsVolunteer: (val) => set({ viewAsVolunteer: val }),
    }),
    {
      name: 'vms-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, viewAsVolunteer: state.viewAsVolunteer }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
