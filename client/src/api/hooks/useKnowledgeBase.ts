import { useQuery, useMutation } from '@tanstack/react-query';
import client from '../client';
import type { KBStats, KBIngestResponse } from '../../types/api';

export const useKBStats = () => {
  return useQuery({
    queryKey: ['kbStats'],
    queryFn: async () => {
      const { data } = await client.get<KBStats>('/kb/stats');
      return data;
    },
  });
};

export const useIngestFiles = () => {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await client.post<KBIngestResponse>('/kb/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
  });
};
