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
  - Las pantallas con sesión van bajo `src/routes/_app/` (layout + guarda `requireUser`). Cada sección tiene su guarda de rol con `requireRole` en `_app/admin.tsx`, `_app/teacher.tsx` y `_app/student.tsx`; `_app/admin/settings.tsx` añade la suya (solo super admin). El menú de cada rol está en `src/lib/roles.ts` (`NAV`); el layout lo pide con `useNav(user)`, que oculta el asistente IA y Telegram si la institución los desactivó (y Telegram si el bot no está configurado) y resuelve las etiquetas que dependen de la configuración académica. El botón de modo claro/oscuro (`ThemeToggle`) está en el menú lateral, la barra superior del móvil y las pantallas de acceso. *Mi cuenta* (`/profile`) es común a todos los roles: pestaña *Cuenta* en móvil y tarjeta del usuario en el menú lateral.
  - Cada pantalla declara `staticData: { title, description }` (título de la barra superior en móvil) y usa `PageHeader` + `PageBody`.
  - No crees tests dentro de `src/routes/` (el plugin los tomaría como rutas); los tests de navegación van en `src/test/` con `renderApp(path)`.
- **Cliente de la API**: tipado desde el OpenAPI. `src/api/schema.d.ts` se genera con `bun run api:types` (con la API levantada); no lo edites a mano y regenéralo cuando cambie la API. Las llamadas se hacen así: `unwrap(api.GET("/api/v1/..."))` (`src/api/client.ts`), que devuelve los datos o lanza un `ApiError` con `status`, `message`, `requestId`, `fieldErrors` (422) y `retryAfter` (429). El token y la reacción ante un 401 se registran con `configureApiAuth`. No uses `fetch` directamente contra la API: para lo que openapi-fetch no cubre (respuestas en streaming, como el chat SSE de `src/api/queries/chat.ts`) usa `authorizedFetch`, que pone el token y lanza el mismo `ApiError`.
- **Apps nativas**: el botón atrás de Android lo gestiona `src/lib/android-back.ts` (cierra diálogo o menú, vuelve atrás o sale). Los diálogos deben tener un `.modal-backdrop` para cerrarse con atrás. Respeta las zonas seguras con `env(safe-area-inset-*)` en barras fijas. El logo fuente es `src-tauri/app-icon.svg` (`bun run tauri icon src-tauri/app-icon.svg` regenera los iconos).
- **Desbloqueo con huella** (solo apps de Android/iOS, `@tauri-apps/plugin-biometric`, registrado en Rust con `#[cfg(mobile)]` y con permisos en `src-tauri/capabilities/mobile.json`): si el usuario lo activa en *Mi cuenta* (`biometricLock` en `usePreferences`, por dispositivo), `BiometricGate` (`src/components/layout/biometric-lock.tsx`, en `_app.tsx`) bloquea la app al abrirla y al volver tras 5 minutos en segundo plano (no si se acaba de iniciar sesión: `markSignedIn()`). Al activarlo, el teléfono recibe una credencial de la API (`POST /auth/biometric`, guardada en `biometricLogin`; si la sesión tiene más de 10 minutos la API responde 403 y *Mi cuenta* pide la contraseña, que se envía como `current_password`) y el login muestra *Entrar con huella* bajo *Iniciar sesión*: tras verificar la huella la envía a `POST /auth/login/biometric`, sin usuario ni contraseña. Cerrar sesión la conserva; desactivar el ajuste la borra (`DELETE /auth/biometric/{id}`) y cambiar la contraseña la invalida (se pide otra sola al volver a entrar). Usa siempre `isMobileApp()`/`biometricAvailable()`/`verifyIdentity()` de `src/lib/biometric.ts`; en la web y en Windows no se ofrece.
- **Descargas**: los instaladores se publican con nombre fijo (`Notas-windows-x64-setup.exe`, `Notas-android.apk`) para que `DOWNLOAD_URLS` (`src/lib/config.ts`) apunte siempre al último release; no cambies esos nombres en el workflow sin actualizarlas. `DownloadApp` los muestra en el login de la web según el sistema.
- **Enlaces externos** (t.me, releases…): `openExternal(url)` de `src/lib/open-url.ts` (plugin-opener en Tauri, pestaña nueva en la web).
- **Datos del servidor**: TanStack Query, con `queryOptions` por recurso en `src/api/queries/`.
- **Formularios**: `useAppForm` (`src/components/form/form.tsx`) con `validators: { onSubmit: EsquemaValibot }` y `form.AppField` → `field.TextField` / `field.SelectField`, más `form.SubmitButton`. Ante errores de la API usa `applyApiErrors(form, error)`: pone los 422 en cada campo y devuelve el mensaje general para `<FormError>`.
- **Componentes compartidos** (`src/components/ui/`): `DataTable` (tabla en escritorio, tarjetas en móvil, paginación del servidor), `Pagination`, `SearchInput`, `PageHeader`/`PageBody`, `LoadingState`/`EmptyState`/`ErrorState`, `GradeBadge`/`formatGrade`, `toast.success`/`toast.error` y `await confirm({ title, danger })`. Iconos con `lucide-react`.
- **Administración** (`src/components/admin/`): `AccountsList`/`AccountHeader` sirven para coordinadores, profesores y estudiantes (`AccountKind`). Las contraseñas generadas por la API se muestran con `showGeneratedPassword()`. Las consultas y mutaciones están en `src/api/queries/admin.ts`; tras mutar, invalida con `adminKeys`. Los filtros de listas van en los search params de la ruta (`validateSearch` + `stripSearchParams` para no escribir los valores por defecto).
- **Estado global**: Zustand en `src/stores/`. Si persiste, usa `appStorage`.
- **Sesión**: `useSession` (`src/stores/session.ts`) guarda el token (persistido), el usuario (`GET /auth/me`) y `status` (`loading` | `authenticated` | `anonymous`). Usa `signIn(token)`, `signOut()` y `refreshUser()`. Un 401 caduca la sesión sola (`expired: true`) y vacía la caché. Las guardas de ruta esperan a `sessionReady`.
- **UI**: Tailwind CSS v4 + **daisyUI 5**, con los temas `notas` (claro) y `notas-dark` definidos en `src/styles.css` con los colores del diseño. Usa las clases semánticas (`btn-primary`, `bg-base-100`, `text-error`…), no colores fijos. Fuente: Montserrat. **No uses shadcn/ui** ni otra librería de componentes. Diseño *mobile-first*: la misma app corre en Android.
- **Diseño de referencia**: `docs/design/v1/` tiene las capturas de cada pantalla, en escritorio y móvil. Respétalo. Excepción decidida por el responsable: las pantallas de acceso (instalación, login y cambio de contraseña) muestran solo la tarjeta del formulario, sin el panel de marca de la izquierda.
- **Textos de la interfaz en español.**
- **Imports** con el alias `@/` (apunta a `src/`).
- **Formato**: Biome (2 espacios, comillas dobles, ancho 100). El hook `pre-commit` lo aplica solo; usa `bun run check` para formatear y revisar.
- **Tests**: Vitest + Testing Library + MSW. La API simulada está en `src/test/` (`handlers.ts` y `server.ts`), y se renderiza con `renderWithQuery`. Pon cada test junto al archivo que prueba (`*.test.tsx`). Usa MSW 3: la opción es `onUnhandledFrame`. **En los tests no hagas peticiones a URLs `https://` reales** (aunque estén simuladas): el interceptor de MSW abre la conexión TLS real y en Linux puede abortar el worker de Vitest. Usa hosts `http://*.test` configurables (ver `.env.test`).

## Reglas de negocio que la UI debe respetar

- Roles: super admin, coordinador, profesor y estudiante. No hay registro público.
- **Seguridad de la API que la UI debe respetar**: con la contraseña generada (`must_change_password`) la API solo deja usar `/auth/me`, cambiarla y cerrar sesión (403 en lo demás): por eso el login lleva a `/change-password`. Tras varios intentos fallidos el login responde 429 con `Retry-After` (se muestra su mensaje). El instalador (`/setup`) pide el **código de instalación** (cabecera `X-Setup-Token`) cuando `GET /setup/status` devuelve `token_required` (siempre en producción). Las materias de un periodo cerrado no se pueden eliminar (409; el botón queda desactivado). Los CSV generados en el cliente pasan por `toCsv`, que neutraliza los textos que Excel tomaría por fórmulas.
- Las reglas académicas son **configurables por el super admin** (pantalla *Configuración*, `/admin/settings`) y llegan de `GET /settings/academic` (pública): nombre de la institución, tipo de periodo (semestres, trimestres, cuatrimestres o años), número y nombre de las evaluaciones por periodo ("Lapso", "Corte"…), sus pesos, la escala (mínima, máxima, aprobatoria), los decimales admitidos y si la definitiva se redondea al entero. **No pongas en el código 1–20, 3 lapsos, 10 ni "Semestre"/"Lapso"**: usa `useAcademicSettings()` (`src/api/queries/settings.ts`, con los valores por defecto mientras carga) y los helpers de `src/lib/grades.ts` (`parseGrade`, `gradeText`, `formatGrade`, `gradeRule`, `termName`, `termNumbers`, `termsText`). Los textos de periodo y lapso salen de `period_label`, `period_label_plural`, `term_label`, `term_label_plural` y la regla completa de `summary`. Un `staticData` o una entrada de `NAV` puede ser una función de la configuración.
- Por defecto (lo que había antes): Universidad, semestres, 3 lapsos que pesan igual, notas del 1 al 20 con hasta 2 decimales, se aprueba con 10, sin redondeo.
- El **documento de los estudiantes** también es configurable: `document_label` ("Cédula", "DNI"…) y `document_types` (código de 1 a 3 letras y nombre; por defecto V Venezolano y E Extranjero). No pongas en el código V/E ni "Cédula": usa `useDocumentFields()`, `DocumentRow`, `documentNoun` y los esquemas de `src/components/form/document-fields.tsx`. Los campos de la API siguen llamándose `nationality` y `cedula`; la API responde 422 a un tipo no configurado y 409 si se quita un tipo en uso.
- El super admin puede **desactivar el asistente de IA y Telegram** para los estudiantes (`assistant_enabled`, `telegram_enabled`; Telegram exige además el asistente). Desactivados, no aparecen en el menú ni los accesos al asistente, y si se entra a su ruta se muestra un `EmptyState` ("La institución desactivó…") en lugar del chat o la vinculación; la API responde 403.
- La nota definitiva, el aprobado (`final_grade`/`passed` en la planilla) y la proyección las calcula la API; no las recalcules en el front.
- Las contraseñas generadas por la API se muestran una sola vez. También en el **alta masiva de estudiantes desde Excel** (`/admin/students/import`): primero se envía el archivo con `dry_run=true` para revisar cada fila y después con `dry_run=false`; las contraseñas de las cuentas nuevas se ven solo en esa respuesta (con descarga de credenciales en CSV generada en el cliente). Los archivos se descargan con `saveFile` (`src/lib/download.ts`) y, si vienen de la API, se piden con `authorizedFetch`.
- Los periodos se pueden **cerrar** y reabrir (coordinación, panel de periodos en *Periodo escolar*). Un periodo cerrado (`semester.is_closed`) es de solo lectura: la API responde 409 al guardar o importar notas de sus materias, matricular o retirar estudiantes y crear o mover materias. La UI lo marca con `ClosedBadge`/`ClosedPeriodNotice` (`src/components/ui/closed-period.tsx`), deja la planilla sin edición ni barra de guardado, no ofrece sus materias para importar y desactiva esas acciones de administración.
- Al cerrar un periodo se **congelan sus reglas de evaluación** (`semester.rules`, que se conservan aunque se reabra; `null` = sigue la configuración vigente). Las notas de una materia se muestran y validan siempre con las reglas de **su** periodo: usa `useSubjectRules(subject.semester)` o `rulesFor(semester, settings)` (`src/api/queries/settings.ts`), no `useAcademicSettings()` directamente. Los nombres de periodo, la institución y el documento salen siempre de la configuración.
- **Secciones**: cada periodo tiene secciones (A, B…), que la coordinación gestiona en *Periodo escolar* (`SectionsPanel`). Cada estudiante cursa el periodo en **una sola sección** (se asigna en su detalle, `StudentSections`, o en la columna «Sección» del alta masiva) y la necesita para matricularse (409 si no la tiene). Cada materia tiene **un solo profesor por sección** (`setTeacherSubjects` con pares `{subject_id, section_id}`; 409 si otro ya la imparte): así un estudiante nunca tiene dos profesores en una materia. El profesor trabaja cada materia por sección (`/teacher/subjects/$subjectId/$sectionId`, `/teacher/evaluations/$subjectId/$sectionId`) y solo ve a los estudiantes de esa sección; el plan de evaluación es propio de cada sección. El estudiante ve `section` y un único `teacher`.
- **Inasistencias**: un estudiante que no se presenta se marca como inasistente (`absent: true`, sin `value`) en un lapso o en una evaluación; en un lapso con plan, marcarlo en todo el lapso lo hace inasistente en cada evaluación. Cuenta con la nota mínima (la API la guarda en `value`). En las planillas se escribe «I» o se usa el botón «I»; se muestra con `AbsentBadge` (`ABSENT_LABEL`/`ABSENT_SHORT` de `src/lib/grades.ts`).
- Cada lapso de una materia puede tener un **plan de evaluación** que define el profesor (`/teacher/evaluations/$subjectId/$sectionId`, botón *Evaluaciones* de la planilla): evaluaciones con nombre, porcentaje y fecha opcional, que suman como máximo 100 %. Con plan, la nota del lapso la calcula la API (suma de nota × porcentaje, solo con el plan al 100 % y todo calificado): la planilla recibe esos lapsos en `computed_terms` y los muestra sin edición. El plan y sus notas están en `src/api/queries/evaluations.ts` y `src/components/teacher/evaluations.tsx`; el estudiante ve las evaluaciones en el detalle de la materia (`evaluations`). No calcules la nota del lapso ni lo acumulado en el front: vienen de la API (`term_grade`, `accumulated`).
- Cuando se carga o corrige una nota (de un lapso o de una evaluación), la API crea un **aviso** para el estudiante (solo para ese estudiante). Llega **en tiempo real** por SSE (`listenNotifications` sobre `GET /student/notifications/stream`, leído con `readEvents` de `src/api/sse.ts`; se reconecta solo con espera creciente y deja de intentarlo ante 401/403); cada evento refresca `latestNotificationsQuery` (`src/api/queries/notifications.ts`), que además se consulta cada minuto como respaldo. `useNotificationWatcher` (montado en el layout, `src/components/student/notifications.tsx`) muestra los nuevos como **notificación del sistema** si el estudiante lo activó en ese dispositivo (`systemNotifications` en `usePreferences`). Las notificaciones pasan siempre por `src/lib/system-notifications.ts`: plugin-notification de Tauri en las apps nativas y la API `Notification` del navegador en la web. Los avisos se listan en *Avisos* (`/student/notifications`), con el contador en el menú y la campana de la barra superior del móvil.
- Cada alta, corrección o borrado de una nota queda en el **historial de notas** de la materia (lo registra la API). El profesor lo ve desde la planilla (botón *Historial* y por estudiante) y la coordinación en el detalle de la materia: `GradeHistory`/`GradeHistoryModal` (`src/components/grade-history.tsx`) con `gradeHistoryQuery` (`src/api/queries/grade-history.ts`). Tras guardar notas, invalida `gradeHistoryKeys.all`.
- El profesor puede **descargar las notas en Excel**: la materia completa desde la planilla (*Descargar Excel*, también en el plan de evaluación como *Descargar materia*; `downloadSubjectGrades`) y un lapso con sus evaluaciones (*Descargar lapso N*; `downloadTermEvaluationGrades`). El archivo lo genera la API; se pide con `authorizedFetch`, se lee con `readDownload` (nombre de `Content-Disposition`, que la API expone por CORS) y se guarda con `DownloadButton` (`src/components/ui/download-button.tsx`).

## Scripts

| Script | Qué hace |
|---|---|
| `bun run dev` | Versión web (puerto 1420) |
| `bun run check` | Biome: formatea y revisa |
| `bun run typecheck` | TypeScript |
| `bun run test` / `test:watch` | Vitest |
| `bun run test:coverage` | Vitest con cobertura (mínimo 70 %, lo exige el CI) |
| `bun run build` | Build de producción |
| `bun run api:types` | Regenera los tipos de la API desde `http://localhost:8000/openapi.json` |
| `bun run tauri dev` | App de escritorio (requiere Rust) |
| `bun run rust:fmt` / `rust:lint` | cargo fmt / clippy |
| `bun run docker:up` / `docker:down` / `docker:logs` | Versión web en Docker (http://localhost:8080) |
| `bun run release:*` | **Solo el responsable del repo** |

## Planificación

Las tareas, fases y la documentación técnica están en Notion (*Cargador de notas universitarios → Documentación técnica (Front)* y la base de datos *Tareas*, con Componente = Front y ordenadas por Orden). Si tienes acceso, sigue esa documentación y actualiza el estado de la tarea. Si no lo tienes, pide al responsable el detalle de la tarea.
