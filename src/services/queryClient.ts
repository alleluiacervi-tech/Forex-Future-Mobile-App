import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        staleTime: 15000,
      },
      mutations: {
        retry: 0,
      },
    },
  });

// ADDED: singleton instance so AuthContext can clear cache on logout
export const queryClient = createQueryClient();
