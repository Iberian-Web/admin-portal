// admin-portal/src/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita refetch agresivo en cada cambio de foco de pestaña; los datos
      // de administración no cambian tan rápido como para necesitarlo.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
