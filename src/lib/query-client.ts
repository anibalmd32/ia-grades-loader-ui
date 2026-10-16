import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/api/errors";

// Los 4xx no cambian al repetir la petición
function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un solo reintento y nunca ante errores 4xx
      retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
    },
  },
});
