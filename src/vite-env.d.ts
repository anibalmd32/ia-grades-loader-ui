/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Solo en tests: URL simulada (http) de la última versión publicada en GitHub */
  readonly VITE_LATEST_RELEASE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
