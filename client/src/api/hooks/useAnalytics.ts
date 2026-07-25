import { useQuery } from '@tanstack/react-query';
import client from '../client';
import type { AnalyticsDashboard } from '../../types/api';

export const useAnalyticsDashboard = (refetchInterval: number | false = false) => {
  return useQuery({
    queryKey: ['analyticsDashboard'],
    refetchInterval,
    queryFn: async () => {
      const { data } = await client.get<AnalyticsDashboard>('/analytics/dashboard');
      return data;
    },
  });
};
