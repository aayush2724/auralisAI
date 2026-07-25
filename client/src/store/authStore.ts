import { create } from 'zustand';

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('auralis_token'),
  setToken: (token: string) => {
    localStorage.setItem('auralis_token', token);
    set({ token });
  },
  clearToken: () => {
    localStorage.removeItem('auralis_token');
    set({ token: null });
  },
  isAuthenticated: () => !!get().token,
}));
