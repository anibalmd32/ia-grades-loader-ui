import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, KeyRound, LogOut } from "lucide-react";
import { AppVersion } from "@/components/app-version";
import { Avatar } from "@/components/ui/avatar";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { API_URL, RELEASES_URL } from "@/lib/config";
import { openExternal } from "@/lib/open-url";
import { ROLE_LABEL } from "@/lib/roles";
import { type Theme, usePreferences } from "@/stores/preferences";
import { useSession } from "@/stores/session";

const title = "Mi cuenta";
const description = "Tus datos, tu contraseña y la versión de la app.";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Como el sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

export const Route = createFileRoute("/_app/profile")({
  staticData: { title, description: "Datos, contraseña y versión" },
  component: ProfilePage,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-base-content/70 text-sm">{label}</dt>
      <dd className="break-all font-semibold sm:text-right">{children}</dd>
    </div>
  );
}

function ProfilePage() {
  const { user } = Route.useRouteContext();
  // El usuario de la sesión se actualiza (p. ej. al vincular Telegram); el del contexto no
  const current = useSession((s) => s.user) ?? user;
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  const { theme, setTheme } = usePreferences();

  const handleSignOut = async () => {
    await signOut();
    await navigate({ to: "/login" });
  };

  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
          <section className="card card-border bg-base-100">
            <div className="card-body gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={current.full_name} />
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-lg">{current.full_name}</h2>
                  <p className="text-base-content/70 text-sm">{ROLE_LABEL[current.role]}</p>
                </div>
              </div>
              <dl className="flex flex-col gap-3">
                {current.email && <Row label="Correo">{current.email}</Row>}
                {current.cedula_display && <Row label="Cédula">{current.cedula_display}</Row>}
                {current.role === "student" && (
                  <Row label="Telegram">
                    {current.telegram_linked ? "Vinculado" : "No vinculado"}
                  </Row>
                )}
              </dl>
            </div>
          </section>

          <section className="card card-border bg-base-100">
            <div className="card-body gap-3">
              <h2 className="card-title">Seguridad</h2>
              <p className="text-base-content/70 text-sm">
                Al cambiar la contraseña se cerrarán todas tus sesiones abiertas, también en otros
                dispositivos.
              </p>
              <Link to="/change-password" className="btn btn-outline btn-primary">
                <KeyRound className="size-4" />
                Cambiar contraseña
              </Link>
              <button type="button" className="btn btn-outline btn-error" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
          </section>

          <section className="card card-border bg-base-100">
            <div className="card-body gap-3">
              <h2 className="card-title">Apariencia</h2>
              <label className="flex flex-col gap-1">
                <span className="text-base-content/70 text-sm">Tema</span>
                <select
                  className="select w-full"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as Theme)}
                >
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="card card-border bg-base-100">
            <div className="card-body gap-3">
              <h2 className="card-title">Acerca de la app</h2>
              <dl className="flex flex-col gap-3">
                <Row label="Versión">
                  <AppVersion />
                </Row>
                <Row label="Servidor">{API_URL}</Row>
              </dl>
              <button
                type="button"
                className="btn btn-outline btn-primary"
                onClick={() => openExternal(RELEASES_URL)}
              >
                <Download className="size-4" />
                Descargar la última versión
              </button>
            </div>
          </section>
        </div>
      </PageBody>
    </>
  );
}
