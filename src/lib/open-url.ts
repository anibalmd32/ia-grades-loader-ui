import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "@/components/ui/toast";

/**
 * Abre un enlace fuera de la app: en Tauri con el sistema (en Android abre la app de
 * Telegram si es un t.me; en Windows, el navegador); en la web, en una pestaña nueva.
 * Si no se puede abrir, avisa con un toast (nunca deja la promesa rechazada sin tratar).
 */
export async function openExternal(url: string): Promise<void> {
  try {
    if (isTauri()) {
      await openUrl(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.error("No se pudo abrir el enlace.");
  }
}
