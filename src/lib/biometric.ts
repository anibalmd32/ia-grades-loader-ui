import { isTauri } from "@tauri-apps/api/core";
import { authenticate, checkStatus } from "@tauri-apps/plugin-biometric";
import { detectPlatform } from "@/lib/platform";

// Desbloqueo de la app con huella o cara: solo en las apps de Android e iOS (plugin-biometric
// de Tauri). En la web y en Windows no se ofrece.

/** ¿Es la app nativa del móvil? */
export function isMobileApp(): boolean {
  const platform = detectPlatform();
  return isTauri() && (platform === "android" || platform === "ios");
}

/** ¿Tiene el móvil huella o cara configurada? */
export async function biometricAvailable(): Promise<boolean> {
  if (!isMobileApp()) return false;
  try {
    return (await checkStatus()).isAvailable;
  } catch {
    return false;
  }
}

/** Pide la huella o la cara (o el PIN del móvil). true si el usuario se identificó */
export async function verifyIdentity(reason: string): Promise<boolean> {
  try {
    await authenticate(reason, {
      allowDeviceCredential: true,
      title: "Notas",
      cancelTitle: "Cancelar",
    });
    return true;
  } catch {
    return false;
  }
}
