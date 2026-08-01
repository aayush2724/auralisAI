import { create } from 'zustand';

interface AuthState {
  token: string | null;
  role: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  isAuthenticated: () => boolean;
}

function decodeRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initialToken = localStorage.getItem('auralis_token');
  return {
    token: initialToken,
    role: initialToken ? decodeRole(initialToken) : null,
    setToken: (token: string) => {
      localStorage.setItem('auralis_token', token);
      set({ token, role: decodeRole(token) });
    },
    clearToken: () => {
      localStorage.removeItem('auralis_token');
      set({ token: null, role: null });
    },
    isAuthenticated: () => !!get().token,
  };
});
