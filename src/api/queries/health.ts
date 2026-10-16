import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/health", { signal })),
  retry: false,
  // Mientras la API no responda, se vuelve a comprobar cada 10 s
  refetchInterval: (query) => (query.state.status === "error" ? 10_000 : false),
});
