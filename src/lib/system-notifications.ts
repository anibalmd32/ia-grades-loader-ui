import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// Notificaciones del sistema: en las apps nativas (Windows, Android) con plugin-notification
// de Tauri y en la web con la API Notification del navegador.

export type NotificationAccess = "granted" | "denied" | "default" | "unsupported";

function webSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** ¿Puede la app mostrar notificaciones ahora mismo? */
export async function notificationAccess(): Promise<NotificationAccess> {
  if (isTauri()) {
    try {
      return (await isPermissionGranted()) ? "granted" : "default";
    } catch {
      return "unsupported";
    }
  }
  if (!webSupported()) return "unsupported";
  return Notification.permission;
}

/** Pide permiso al usuario (el sistema o el navegador muestran su diálogo) */
export async function requestNotificationAccess(): Promise<NotificationAccess> {
  if (isTauri()) {
    try {
      return await requestPermission();
    } catch {
      return "unsupported";
    }
  }
  if (!webSupported()) return "unsupported";
  return Notification.requestPermission();
}

export type SystemNotification = {
  title: string;
  body: string;
  /** Al tocarla (solo en la web: en las apps nativas abre la app) */
  onClick?: () => void;
};

/** Muestra una notificación del sistema si hay permiso (si no, no hace nada) */
export async function showSystemNotification({ title, body, onClick }: SystemNotification) {
  if (isTauri()) {
    try {
      if (await isPermissionGranted()) sendNotification({ title, body });
    } catch {
      // Sin notificaciones en este sistema: los avisos siguen en la app
    }
    return;
  }
  if (!webSupported() || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, icon: "/favicon.svg" });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    // Chrome en Android solo las permite desde un service worker: se quedan en la app
  }
}
