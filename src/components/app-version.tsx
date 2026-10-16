import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";

// Versión instalada (la del tag del release); en el navegador no hay versión de app
export function AppVersion() {
  const { data } = useQuery({
    queryKey: ["app-version"],
    queryFn: () => (isTauri() ? getVersion() : Promise.resolve(null)),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return <span>{data ? `v${data}` : "web"}</span>;
}
