import { useQuery } from '@tanstack/react-query';
import client from '../client';
import type { ABTestResults } from '../../types/api';

export const useABTestResults = (refetchInterval: number | false = false) => {
  return useQuery({
    queryKey: ['abTestResults'],
    refetchInterval,
    queryFn: async () => {
      const { data } = await client.get<ABTestResults>('/ab-test/results');
      return data;
    },
  });
};
