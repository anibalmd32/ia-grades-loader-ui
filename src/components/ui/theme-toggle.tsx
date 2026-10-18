import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { type Theme, usePreferences } from "@/stores/preferences";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function darkMedia(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
}

function subscribe(onChange: () => void) {
  const media = darkMedia();
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** ¿Pide el sistema el modo oscuro? Se actualiza si el usuario lo cambia en el sistema */
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => darkMedia()?.matches ?? false,
    () => false,
  );
}

/** Tema que se ve de verdad: "system" se resuelve con prefers-color-scheme */
export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  if (theme !== "system") return theme;
  return prefersDark ? "dark" : "light";
}

/** Botón para alternar entre modo claro y oscuro (guarda la preferencia explícita) */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const current = resolveTheme(theme, usePrefersDark());
  const next = current === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-square btn-sm ${className}`}
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      {current === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
