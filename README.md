# Notas (front)

App de escritorio (Windows) y móvil (Android) para cargar y consultar notas universitarias. Consume la API de `ia-grades-loader-api`.

## Stack

- Tauri v2 (Rust) + React + TypeScript + Vite
- TanStack Router (rutas por archivos en `src/routes`), TanStack Query y TanStack Form
- Valibot, Zustand (persistido con `@tauri-apps/plugin-store`)
- Tailwind CSS v4 + daisyUI 5
- Bun

## Requisitos (Windows)

- Bun
- Rust (rustup, toolchain stable MSVC)
- Visual Studio Build Tools con "Desktop development with C++"
- WebView2 (incluido en Windows 11)

## Desarrollo

```sh
bun install
bun run tauri dev
```

## Estructura

- `src/`: app React (`routes/`, `stores/`, `lib/`)
- `src-tauri/`: shell de Tauri (Rust)
- `docs/design/v1/`: diseño de las vistas (escritorio y móvil)
