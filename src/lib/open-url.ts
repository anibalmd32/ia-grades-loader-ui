import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Abre un enlace fuera de la app: en Tauri con el sistema (en Android abre la app de
 * Telegram si es un t.me; en Windows, el navegador); en la web, en una pestaña nueva.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
