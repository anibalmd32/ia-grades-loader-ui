import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage } from "@/lib/app-storage";

export type Theme = "system" | "light" | "dark";
export type LoginTab = "staff" | "student";

type PreferencesState = {
  theme: Theme;
  /** Última pestaña usada en el login */
  loginTab: LoginTab;
  setTheme: (theme: Theme) => void;
  setLoginTab: (tab: LoginTab) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      loginTab: "staff",
      setTheme: (theme) => set({ theme }),
      setLoginTab: (loginTab) => set({ loginTab }),
    }),
    {
      name: "preferences",
      storage: createJSONStorage(() => appStorage),
    },
  ),
);

/** Nombre del tema de daisyUI ("system" = sin data-theme, decide prefers-color-scheme) */
export const DAISY_THEME: Record<Exclude<Theme, "system">, string> = {
  light: "notas",
  dark: "notas-dark",
};
