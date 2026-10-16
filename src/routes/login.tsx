import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { isApiError } from "@/api/errors";
import { setupStatusQuery } from "@/api/queries/setup";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { AuthLayout } from "@/components/layout/auth-layout";
import { homePath } from "@/lib/roles";
import { type LoginTab, usePreferences } from "@/stores/preferences";
import { sessionReady, type User, useSession } from "@/stores/session";

export const Route = createFileRoute("/login")({
  validateSearch: v.object({ redirect: v.optional(v.string()) }),
  beforeLoad: async ({ context }) => {
    // Sin super admin todavía → instalador (si la API no responde, se muestra el login igual)
    const status = await context.queryClient.ensureQueryData(setupStatusQuery).catch(() => null);
    if (status && !status.installed) throw redirect({ to: "/setup" });

    await sessionReady;
    const { user } = useSession.getState();
    if (user) throw redirect({ to: homePath(user.role) });
  },
  component: LoginPage,
});

const StaffSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email("Escribe un email válido.")),
  password: v.pipe(v.string(), v.minLength(1, "Escribe tu contraseña.")),
});

const StudentSchema = v.object({
  nationality: v.picklist(["V", "E"]),
  cedula: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{1,9}$/, "Escribe solo números, sin puntos ni letras."),
  ),
  password: v.pipe(v.string(), v.minLength(1, "Escribe tu contraseña.")),
});

const INVALID_CREDENTIALS: Record<LoginTab, string> = {
  staff: "Email o contraseña incorrectos.",
  student: "Cédula o contraseña incorrectas.",
};

/** Mensaje de error del login: genérico ante credenciales inválidas */
function loginError(tab: LoginTab, error: unknown): string | null {
  if (isApiError(error) && (error.status === 401 || error.status === 400 || error.status === 403)) {
    return error.status === 403 ? error.message : INVALID_CREDENTIALS[tab];
  }
  return null;
}

function useFinishLogin() {
  const signIn = useSession((s) => s.signIn);
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  return async (accessToken: string) => {
    const user: User = await signIn(accessToken);
    if (user.must_change_password) {
      await navigate({ to: "/change-password", replace: true });
    } else if (redirectTo?.startsWith("/")) {
      await navigate({ href: redirectTo, replace: true });
    } else {
      await navigate({ to: homePath(user.role), replace: true });
    }
  };
}

function StaffForm() {
  const finishLogin = useFinishLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: StaffSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const token = await unwrap(
          api.POST("/api/v1/auth/login/staff", {
            body: { email: value.email.trim(), password: value.password },
          }),
        );
        await finishLogin(token.access_token);
      } catch (error) {
        setFormError(loginError("staff", error) ?? applyApiErrors(form, error));
      }
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormError message={formError} />
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="Email"
            type="email"
            placeholder="tu@universidad.edu"
            autoComplete="username"
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField label="Contraseña" type="password" autoComplete="current-password" />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton label="Iniciar sesión" className="mt-4 w-full" />
      </form.AppForm>
      <p className="mt-4 text-base-content/70 text-sm">
        ¿Olvidaste tu contraseña? Pídele a tu coordinador que la restablezca.
      </p>
    </form>
  );
}

function StudentForm() {
  const finishLogin = useFinishLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { nationality: "V" as "V" | "E", cedula: "", password: "" },
    validators: { onSubmit: StudentSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const token = await unwrap(
          api.POST("/api/v1/auth/login/student", {
            body: {
              nationality: value.nationality,
              cedula: Number(value.cedula.trim()),
              password: value.password,
            },
          }),
        );
        await finishLogin(token.access_token);
      } catch (error) {
        setFormError(loginError("student", error) ?? applyApiErrors(form, error));
      }
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormError message={formError} />
      <div className="grid grid-cols-[6rem_1fr] items-end gap-3">
        <form.AppField name="nationality">
          {(field) => (
            <field.SelectField
              label="Cédula de identidad"
              aria-label="Tipo de cédula"
              options={[
                { value: "V", label: "V" },
                { value: "E", label: "E" },
              ]}
            />
          )}
        </form.AppField>
        <form.AppField name="cedula">
          {(field) => (
            <field.TextField
              label=" "
              aria-label="Número de cédula"
              inputMode="numeric"
              placeholder="Número, sin puntos"
              autoComplete="username"
            />
          )}
        </form.AppField>
      </div>
      <p className="-mt-1 text-base-content/60 text-xs">V = venezolano · E = extranjero</p>
      <form.AppField name="password">
        {(field) => (
          <field.TextField label="Contraseña" type="password" autoComplete="current-password" />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton label="Iniciar sesión" className="mt-4 w-full" />
      </form.AppForm>
      <p className="mt-4 text-base-content/70 text-sm">
        ¿No tienes cuenta? Las crea tu coordinador; no hay registro público.
      </p>
    </form>
  );
}

const TABS: { value: LoginTab; label: string; description: string }[] = [
  { value: "staff", label: "Personal", description: "Super admin, coordinadores y profesores." },
  { value: "student", label: "Estudiante", description: "Entra con tu cédula y contraseña." },
];

function LoginPage() {
  const { loginTab, setLoginTab } = usePreferences();
  const expired = useSession((s) => s.expired);
  const current = TABS.find((t) => t.value === loginTab) ?? TABS[0];

  return (
    <AuthLayout title="Inicia sesión" description={current.description}>
      {expired && (
        <div role="alert" className="alert alert-warning alert-soft mb-4">
          <TriangleAlert className="size-5 shrink-0" />
          <span>Tu sesión expiró. Vuelve a iniciar sesión.</span>
        </div>
      )}
      <div role="tablist" className="mb-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === current.value}
            className={`btn rounded-full px-6 ${tab.value === current.value ? "btn-primary" : "btn-outline btn-primary"}`}
            onClick={() => setLoginTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current.value === "staff" ? <StaffForm /> : <StudentForm />}
    </AuthLayout>
  );
}
