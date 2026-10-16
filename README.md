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

Necesitas la API (`ia-grades-loader-api`) corriendo en `http://localhost:8000`.

```sh
bun install
cp .env.example .env      # ajusta VITE_API_URL si hace falta
bun run dev               # versión web en http://localhost:1420
bun run tauri dev         # app de escritorio (Windows)
```

La versión web es suficiente para desarrollar las pantallas; solo hace falta Rust para `tauri dev` y Android.

## Android

Requisitos: Android Studio con SDK, Build-Tools, Command-line Tools y NDK; variables `JAVA_HOME` (sirve el JDK de Android Studio), `ANDROID_HOME` y `NDK_HOME`; targets de Rust:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

```sh
bun run tauri android dev                 # emulador o móvil por USB
bun run tauri android build --apk         # APK de release (sin firmar si no hay keystore.properties)
```

En debug se permite HTTP sin cifrar para llegar a la API local (en el emulador la API está en `http://10.0.2.2:8000`). El proyecto Android generado está en `src-tauri/gen/android`.

La firma del APK de release la hace el CI con el keystore guardado en los secretos del repositorio. Para firmar en local, crea `src-tauri/gen/android/keystore.properties` (no se commitea) con `storeFile`, `storePassword`, `keyAlias` y `keyPassword`.

## Formato

Biome formatea y revisa el código (`bun run check`). Al hacer commit, lefthook ejecuta Biome sobre los archivos del commit; el hook se instala solo con `bun install`.

## Publicar una versión

Haz commit y push de todo lo que quieras publicar. Después, desde `main`:

```sh
bun run release:patch   # v0.0.1 → v0.0.2 (correcciones)
bun run release:minor   # v0.0.2 → v0.1.0 (funciones nuevas)
bun run release:major   # v0.1.0 → v1.0.0 (cambios grandes)
```

El script calcula la siguiente versión a partir del último tag, crea el tag `vX.Y.Z` sobre el último commit y lo sube. No hace commits. El workflow de release pone esa versión en la app, compila y publica los instaladores en GitHub Releases. En el repo la versión se queda fija en `0.0.1` (Android no admite `0.0.0`).

## Estructura

- `src/`: app React (`routes/`, `stores/`, `lib/`)
- `src-tauri/`: shell de Tauri (Rust)
- `docs/design/v1/`: diseño de las vistas (escritorio y móvil)
