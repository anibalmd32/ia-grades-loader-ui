import { queryOptions } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";

export type Health = { status: string };

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: async ({ signal }): Promise<Health> => {
    const response = await fetch(`${API_URL}/health`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  retry: false,
  // Mientras la API no responda, se vuelve a comprobar cada 10 s
  refetchInterval: (query) => (query.state.status === "error" ? 10_000 : false),
});
