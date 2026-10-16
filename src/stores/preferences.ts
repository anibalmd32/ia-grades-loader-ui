import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { tauriStorage } from "@/lib/tauri-storage";

export type Theme = "system" | "light" | "dark";

type PreferencesState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "preferences",
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
