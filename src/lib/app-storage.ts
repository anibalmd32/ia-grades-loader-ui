import { isTauri } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

// Dentro de Tauri se persiste en un archivo del plugin-store; en el navegador
// (desarrollo web con `bun run dev`) se usa localStorage.
function createTauriStorage(): StateStorage {
  const store = new LazyStore("app.json");
  return {
    getItem: async (name) => (await store.get<string>(name)) ?? null,
    setItem: async (name, value) => {
      await store.set(name, value);
      await store.save();
    },
    removeItem: async (name) => {
      await store.delete(name);
      await store.save();
    },
  };
}

export const appStorage: StateStorage = isTauri() ? createTauriStorage() : localStorage;
