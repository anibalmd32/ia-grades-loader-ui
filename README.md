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

## Contribuir

Todo cambio entra por pull request a `main` (protegida: CI en verde y aprobación). Las normas para personas y agentes de IA están en [AGENTS.md](AGENTS.md); entre ellas, ningún commit ni PR puede atribuir el trabajo a una IA.

## Desarrollo

Necesitas la API (`ia-grades-loader-api`) corriendo en `http://localhost:8000`.

```sh
bun install
cp .env.example .env      # ajusta VITE_API_URL si hace falta
bun run dev               # versión web en http://localhost:1420
bun run tauri dev         # app de escritorio (Windows)
```

La versión web es suficiente para desarrollar las pantallas; solo hace falta Rust para `tauri dev` y Android.

## Levantar la API con Docker

No hace falta Python, basta Docker Desktop:

1. Clona `ia-grades-loader-api` y copia `.env.example` a `.env`.
2. En ese `.env` rellena `MYSQL_PASSWORD` y `MYSQL_ROOT_PASSWORD` (cualquier valor), `MYSQL_USER` (distinto de `root`), `JWT_SECRET_KEY` (32+ caracteres) y `APP_ENV=development`. `CORS_ORIGINS` debe incluir `http://localhost:1420`, `tauri://localhost` y `http://tauri.localhost`. `LLM_API_KEY` y `TELEGRAM_*` son opcionales.
3. `docker compose up -d --build`: la API queda en `http://localhost:8000` (Swagger en `/docs`) y aplica las migraciones sola.
4. El primer uso crea el super admin desde la pantalla de instalación de la app (o `POST /api/v1/setup`).

Si la API no responde, la app muestra un aviso arriba con la URL que está usando.

## Calidad

```sh
bun run check       # Biome: formatea y revisa
bun run typecheck   # TypeScript
bun run test        # Vitest + Testing Library + MSW (API simulada en src/test)
bun run rust:fmt    # cargo fmt
bun run rust:lint   # cargo clippy
```

El CI (`.github/workflows/ci.yml`) ejecuta todo esto en cada pull request y push a `main`.

## Producción (versión web con Docker)

La imagen compila la app con Bun y sirve los estáticos con nginx (rutas de la SPA, `/healthz`, caché larga para `/assets`). La URL de la API se pasa **al arrancar el contenedor** con `API_URL`, así la misma imagen sirve para cualquier entorno:

```sh
bun run docker:up      # construye la imagen y arranca el contenedor en http://localhost:8080
bun run docker:logs    # ver los logs
bun run docker:down    # parar y borrar el contenedor
```

`API_URL` se toma de la variable de entorno y, si no existe, de `VITE_API_URL` del `.env` (en local basta con el `.env` de desarrollo). `WEB_PORT` cambia el puerto. Sin compose:

```sh
docker build -t notas-web .
docker run -d -p 8080:80 -e API_URL=https://api.ejemplo.com/api/v1 notas-web
```

Sin `API_URL` el contenedor no arranca. El origen donde se publique la web (p. ej. `https://notas.ejemplo.com`) debe estar en `CORS_ORIGINS` de la API.

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

Al hacer commit, lefthook ejecuta Biome sobre los archivos del commit; el hook se instala solo con `bun install`.

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
