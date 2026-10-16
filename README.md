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

## Publicar una versión

Desde `main` y sin cambios pendientes:

```sh
bun run release:patch   # 0.0.1 → 0.0.2 (correcciones)
bun run release:minor   # 0.0.2 → 0.1.0 (funciones nuevas)
bun run release:major   # 0.1.0 → 1.0.0 (cambios grandes)
```

El script sube la versión en `package.json`, `tauri.conf.json` y `Cargo.toml`, crea el commit y el tag `vX.Y.Z` y los sube a GitHub. El workflow de release compila y publica los instaladores en GitHub Releases. No hay que editar la versión a mano.

## Estructura

- `src/`: app React (`routes/`, `stores/`, `lib/`)
- `src-tauri/`: shell de Tauri (Rust)
- `docs/design/v1/`: diseño de las vistas (escritorio y móvil)
