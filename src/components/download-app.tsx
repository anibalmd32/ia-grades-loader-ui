import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { Download, Info } from "lucide-react";
import { DOWNLOAD_URLS, LATEST_RELEASE_API, RELEASES_URL } from "@/lib/config";
import { detectPlatform, type Platform } from "@/lib/platform";

/** Número de la última versión publicada (GitHub, sin token); si falla, no se muestra */
const latestVersionQuery = {
  queryKey: ["app", "latest-release"],
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const response = await fetch(LATEST_RELEASE_API, { signal });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const release = (await response.json()) as { tag_name?: string };
    return release.tag_name?.replace(/^v/, "") ?? null;
  },
  staleTime: 60 * 60 * 1000,
  retry: false,
} as const;

const APPS = {
  windows: { label: "Descargar para Windows", href: DOWNLOAD_URLS.windows },
  android: { label: "Descargar para Android", href: DOWNLOAD_URLS.android },
};

const UNAVAILABLE: Partial<Record<Platform, string>> = {
  ios: "iPhone y iPad",
  mac: "macOS",
};

function DownloadButton({ app, primary }: { app: keyof typeof APPS; primary: boolean }) {
  return (
    <a
      href={APPS[app].href}
      className={`btn w-full ${primary ? "btn-primary" : "btn-outline btn-primary"}`}
      download
    >
      <Download className="size-4" />
      {APPS[app].label}
    </a>
  );
}

/**
 * Descarga de la app nativa según el sistema del visitante (solo en la versión web).
 * Windows/Android: descarga directa del release más reciente; macOS/iOS: aún no disponible.
 */
export function DownloadApp({ platform = detectPlatform() }: { platform?: Platform }) {
  const version = useQuery({ ...latestVersionQuery, enabled: !isTauri() });
  if (isTauri()) return null;

  const unavailable = UNAVAILABLE[platform];
  const versionText = version.data ? ` · versión ${version.data}` : "";

  return (
    <section aria-label="Descargar la app" className="mt-6 border-base-300 border-t pt-6">
      <h2 className="font-semibold text-sm">Descarga la app{versionText}</h2>
      {unavailable ? (
        <div role="note" className="alert alert-soft mt-3">
          <Info className="size-5 shrink-0" />
          <span>
            La app aún no está disponible para {unavailable}. Puedes seguir usando esta versión web.
          </span>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {platform === "android" ? (
            <DownloadButton app="android" primary />
          ) : platform === "windows" ? (
            <DownloadButton app="windows" primary />
          ) : (
            <>
              <DownloadButton app="windows" primary={false} />
              <DownloadButton app="android" primary={false} />
            </>
          )}
        </div>
      )}
      <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="link mt-3 block text-xs">
        Ver todas las descargas e instrucciones
      </a>
    </section>
  );
}
