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

## Formato

Biome formatea y revisa el código (`bun run check`). Al hacer commit, lefthook ejecuta Biome sobre los archivos del commit; el hook se instala solo con `bun install`.

## Publicar una versión

Haz commit y push de todo lo que quieras publicar. Después, desde `main`:

```sh
bun run release:patch   # v0.0.1 → v0.0.2 (correcciones)
bun run release:minor   # v0.0.2 → v0.1.0 (funciones nuevas)
bun run release:major   # v0.1.0 → v1.0.0 (cambios grandes)
```

El script calcula la siguiente versión a partir del último tag, crea el tag `vX.Y.Z` sobre el último commit y lo sube. No hace commits. El workflow de release pone esa versión en la app, compila y publica los instaladores en GitHub Releases. En el repo la versión se queda en `0.0.0`.

## Estructura

- `src/`: app React (`routes/`, `stores/`, `lib/`)
- `src-tauri/`: shell de Tauri (Rust)
- `docs/design/v1/`: diseño de las vistas (escritorio y móvil)
