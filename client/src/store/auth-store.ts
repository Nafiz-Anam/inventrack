import { create } from 'zustand';
import { User, AuthTokens } from '@/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: () => {
    if (typeof window !== 'undefined') {
      const tokens = localStorage.getItem('tokens');
      const user = localStorage.getItem('user');
      if (tokens && user) {
        set({
          tokens: JSON.parse(tokens),
          user: JSON.parse(user),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    }
  },

  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const user = data.data.user;
    const tokens = data.data.tokens;
    localStorage.setItem('tokens', JSON.stringify(tokens));
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, tokens, isAuthenticated: true });
  },

  register: async (name: string, email: string, password: string) => {
    await api.post('/auth/register', { name, email, password });
  },

  logout: async () => {
    try {
      const tokens = get().tokens;
      if (tokens?.refresh?.token) {
        await api.post('/auth/logout', { refreshToken: tokens.refresh.token });
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('tokens');
    localStorage.removeItem('user');
    set({ user: null, tokens: null, isAuthenticated: false });
  },
}));
