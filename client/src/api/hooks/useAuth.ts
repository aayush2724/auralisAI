import { useMutation } from '@tanstack/react-query';
import client, { queryClient } from '../client';
import type { TokenResponse } from '../../types/api';
import { useAuthStore } from '../../store/authStore';

export const useLogin = () => {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await client.post<TokenResponse>('/auth/token', formData);
      useAuthStore.getState().setToken(data.access_token);
      return data;
    },
  });
};

export const useSignup = () => {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data } = await client.post<{ id: string; email: string; role: string }>('/auth/signup', payload);
      return data;
    },
  });
};

export const useLogout = () => {
  return () => {
    useAuthStore.getState().clearToken();
    queryClient.clear();
    window.location.href = '/';
  };
};

export const useIsAuthenticated = () => {
  return useAuthStore((state) => state.isAuthenticated());
};
