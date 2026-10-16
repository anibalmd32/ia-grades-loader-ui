# Instrucciones para agentes (Claude Code, Codex, Cursor…)

Front de **Notas**, la app para cargar y consultar notas universitarias. Consume la API de `ia-grades-loader-api`. Lee también el `README.md`.

## Reglas obligatorias

1. **Nunca atribuyas el trabajo a una IA.** Ni en commits ni en pull requests: nada de `Co-Authored-By: Claude…`, `Generated with Claude Code`, emojis 🤖 ni enlaces de sesión. El autor es la persona que hace el commit. Un hook `commit-msg` (lefthook) rechaza esos mensajes; si falla, quita la línea, no te saltes el hook.
2. **Nunca hagas push a `main`.** Todo cambio entra por pull request desde una rama propia. `main` está protegida: exige el CI en verde y la aprobación del responsable.
3. **No lances releases.** No ejecutes `bun run release:*` ni crees o subas tags `v*`. Solo el responsable del repo publica versiones.
4. **No uses `--no-verify`** ni desactives los hooks de lefthook.
5. **Usa Bun**, nunca npm, pnpm ni yarn: `bun install`, `bun add`, `bun run <script>`, `bunx <bin>`.
6. **No commitees secretos**: `.env`, keystores (`*.jks`) ni `keystore.properties`.

## Flujo de trabajo

```sh
git switch main && git pull
git switch -c feat/descripcion-corta    # o fix/…, chore/…, docs/…
# … cambios …
bun run check && bun run typecheck && bun run test
git commit -m "feat: descripción en español"
git push -u origin feat/descripcion-corta
gh pr create --base main --fill
```

- **Commits pequeños, en español, con [Conventional Commits](https://www.conventionalcommits.org/es/)**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, `refactor:`. Por ejemplo: `feat: login de estudiantes con cédula`.
- **PR**: título igual que un commit y una descripción breve (qué cambia, cómo probarlo y capturas si hay UI). Sin atribución a IA.
- Antes de abrir el PR deben pasar `bun run check`, `bun run typecheck`, `bun run test` y `bun run build`. Son los mismos pasos que ejecuta el CI.

## Desarrollo

Por ahora **solo se desarrolla la versión web**. No hace falta Rust ni Android.

```sh
bun install                 # instala dependencias y los hooks de lefthook
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api/v1
bun run dev                 # http://localhost:1420
```

La API tiene que estar levantada en `http://localhost:8000`; el README explica cómo hacerlo con Docker. Swagger está en `/docs` y el esquema en `/openapi.json`.

## Stack y convenciones

- **Tauri v2 + React 19 + TypeScript (strict) + Vite.** El código debe funcionar en el navegador y en Tauri. Cualquier API de Tauri (plugins, `getVersion`, etc.) va protegida con `isTauri()` de `@tauri-apps/api/core` y necesita una alternativa web. Ejemplo: `src/lib/app-storage.ts`.
- **Rutas**: TanStack Router con rutas por archivos en `src/routes/`. `src/routeTree.gen.ts` se genera solo; no lo edites a mano.
  - Las pantallas con sesión van bajo `src/routes/_app/` (layout + guarda `requireUser`). Cada sección tiene su guarda de rol con `requireRole` en `_app/admin.tsx`, `_app/teacher.tsx` y `_app/student.tsx`. El menú de cada rol está en `src/lib/roles.ts` (`NAV`).
  - Cada pantalla declara `staticData: { title, description }` (título de la barra superior en móvil) y usa `PageHeader` + `PageBody`.
  - No crees tests dentro de `src/routes/` (el plugin los tomaría como rutas); los tests de navegación van en `src/test/` con `renderApp(path)`.
- **Cliente de la API**: tipado desde el OpenAPI. `src/api/schema.d.ts` se genera con `bun run api:types` (con la API levantada); no lo edites a mano y regenéralo cuando cambie la API. Las llamadas se hacen así: `unwrap(api.GET("/api/v1/..."))` (`src/api/client.ts`), que devuelve los datos o lanza un `ApiError` con `status`, `message`, `requestId`, `fieldErrors` (422) y `retryAfter` (429). El token y la reacción ante un 401 se registran con `configureApiAuth`. No uses `fetch` directamente contra la API.
- **Datos del servidor**: TanStack Query, con `queryOptions` por recurso en `src/api/queries/`.
- **Formularios**: `useAppForm` (`src/components/form/form.tsx`) con `validators: { onSubmit: EsquemaValibot }` y `form.AppField` → `field.TextField` / `field.SelectField`, más `form.SubmitButton`. Ante errores de la API usa `applyApiErrors(form, error)`: pone los 422 en cada campo y devuelve el mensaje general para `<FormError>`.
- **Componentes compartidos** (`src/components/ui/`): `DataTable` (tabla en escritorio, tarjetas en móvil, paginación del servidor), `Pagination`, `SearchInput`, `PageHeader`/`PageBody`, `LoadingState`/`EmptyState`/`ErrorState`, `GradeBadge`/`formatGrade`, `toast.success`/`toast.error` y `await confirm({ title, danger })`. Iconos con `lucide-react`.
- **Estado global**: Zustand en `src/stores/`. Si persiste, usa `appStorage`.
- **Sesión**: `useSession` (`src/stores/session.ts`) guarda el token (persistido), el usuario (`GET /auth/me`) y `status` (`loading` | `authenticated` | `anonymous`). Usa `signIn(token)`, `signOut()` y `refreshUser()`. Un 401 caduca la sesión sola (`expired: true`) y vacía la caché. Las guardas de ruta esperan a `sessionReady`.
- **UI**: Tailwind CSS v4 + **daisyUI 5**, con los temas `notas` (claro) y `notas-dark` definidos en `src/styles.css` con los colores del diseño. Usa las clases semánticas (`btn-primary`, `bg-base-100`, `text-error`…), no colores fijos. Fuente: Montserrat. **No uses shadcn/ui** ni otra librería de componentes. Diseño *mobile-first*: la misma app corre en Android.
- **Diseño de referencia**: `docs/design/v1/` tiene las capturas de cada pantalla, en escritorio y móvil. Respétalo.
- **Textos de la interfaz en español.**
- **Imports** con el alias `@/` (apunta a `src/`).
- **Formato**: Biome (2 espacios, comillas dobles, ancho 100). El hook `pre-commit` lo aplica solo; usa `bun run check` para formatear y revisar.
- **Tests**: Vitest + Testing Library + MSW. La API simulada está en `src/test/` (`handlers.ts` y `server.ts`), y se renderiza con `renderWithQuery`. Pon cada test junto al archivo que prueba (`*.test.tsx`). Usa MSW 3: la opción es `onUnhandledFrame`.

## Reglas de negocio que la UI debe respetar

- Roles: super admin, coordinador, profesor y estudiante. No hay registro público.
- Las notas van de 1 a 20 con hasta 2 decimales. Hay 3 lapsos que pesan igual y se aprueba con 10.
- La nota definitiva y la proyección las calcula la API; no las recalcules en el front.
- Las contraseñas generadas por la API se muestran una sola vez.

## Scripts

| Script | Qué hace |
|---|---|
| `bun run dev` | Versión web (puerto 1420) |
| `bun run check` | Biome: formatea y revisa |
| `bun run typecheck` | TypeScript |
| `bun run test` / `test:watch` | Vitest |
| `bun run build` | Build de producción |
| `bun run api:types` | Regenera los tipos de la API desde `http://localhost:8000/openapi.json` |
| `bun run tauri dev` | App de escritorio (requiere Rust) |
| `bun run rust:fmt` / `rust:lint` | cargo fmt / clippy |
| `bun run docker:up` / `docker:down` / `docker:logs` | Versión web en Docker (http://localhost:8080) |
| `bun run release:*` | **Solo el responsable del repo** |

## Planificación

Las tareas, fases y la documentación técnica están en Notion (*Cargador de notas universitarios → Documentación técnica (Front)* y la base de datos *Tareas*, con Componente = Front y ordenadas por Orden). Si tienes acceso, sigue esa documentación y actualiza el estado de la tarea. Si no lo tienes, pide al responsable el detalle de la tarea.
