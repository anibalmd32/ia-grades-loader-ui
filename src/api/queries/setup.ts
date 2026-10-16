import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";

/** ¿Existe ya el super admin? Decide si se muestra el instalador */
export const setupStatusQuery = queryOptions({
  queryKey: ["setup", "status"],
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/setup/status", { signal })),
  staleTime: Number.POSITIVE_INFINITY,
});
