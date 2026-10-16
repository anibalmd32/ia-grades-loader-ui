import { QueryClient } from "@tanstack/react-query";

function isClientError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un solo reintento y nunca ante errores 4xx (no van a cambiar al repetir)
      retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
    },
  },
});
