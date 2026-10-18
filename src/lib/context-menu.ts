import { isTauri } from "@tauri-apps/api/core";
import { detectPlatform } from "@/lib/platform";

/** Evita el menú del clic derecho (Recargar, Inspeccionar…) */
function preventContextMenu(event: MouseEvent) {
  event.preventDefault();
}

/**
 * En la app de Windows el clic derecho abre el menú del navegador interno (WebView2), que
 * no tiene sentido en una app de escritorio. Se desactiva solo ahí: en la web y en Android
 * (donde la pulsación larga sirve para seleccionar y copiar texto) se mantiene, y en
 * desarrollo también, para poder inspeccionar. Devuelve cómo volver a activarlo (o null).
 */
export function disableContextMenu({
  tauri = isTauri(),
  platform = detectPlatform(),
  dev = import.meta.env.DEV,
}: {
  tauri?: boolean;
  platform?: string;
  dev?: boolean;
} = {}): (() => void) | null {
  if (!tauri || platform !== "windows" || dev) return null;
  document.addEventListener("contextmenu", preventContextMenu);
  return () => document.removeEventListener("contextmenu", preventContextMenu);
}
