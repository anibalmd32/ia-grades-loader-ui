import { exit, onBackButtonPress } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";

/**
 * Cierra lo que esté abierto por encima de la pantalla: un diálogo (con fondo para cerrar)
 * o el menú lateral. Devuelve true si había algo abierto.
 */
export function closeTopLayer(doc: Document = document): boolean {
  const backdrop = doc.querySelector<HTMLButtonElement>(".modal-open .modal-backdrop");
  if (backdrop) {
    backdrop.click();
    return true;
  }
  // Diálogos sin fondo para cerrar (p. ej. la contraseña generada, que solo se ve una vez):
  // el botón atrás no los cierra, hay que pulsar su botón
  if (doc.querySelector(".modal-open")) return true;
  const drawer = doc.querySelector<HTMLInputElement>(".drawer-toggle:checked");
  if (drawer) {
    drawer.checked = false;
    return true;
  }
  return false;
}

type BackActions = { back: () => void; exit: () => void };

/** Botón atrás: cerrar diálogo o menú → volver a la pantalla anterior → salir de la app */
export function handleBack(
  canGoBack: boolean,
  actions: BackActions = { back: () => window.history.back(), exit: () => void exit(0) },
): void {
  if (closeTopLayer()) return;
  if (canGoBack) actions.back();
  else actions.exit();
}

/** Solo Android (en Windows y en la web el evento no existe) */
export function registerAndroidBackButton(): void {
  if (!isTauri()) return;
  void onBackButtonPress(({ canGoBack }) => handleBack(canGoBack)).catch(() => {});
}
