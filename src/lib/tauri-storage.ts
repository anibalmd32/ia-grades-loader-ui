import { LazyStore } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

// Persistencia de Zustand en un archivo del plugin-store de Tauri (no localStorage)
const store = new LazyStore("app.json");

export const tauriStorage: StateStorage = {
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
