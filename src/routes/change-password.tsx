import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { isApiError } from "@/api/errors";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { AuthLayout } from "@/components/layout/auth-layout";
import { toast } from "@/components/ui/toast";
import { requireUser } from "@/lib/guards";
import { homePath } from "@/lib/roles";
import { type User, useSession } from "@/stores/session";

export const Route = createFileRoute("/change-password")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location) }),
  component: ChangePasswordPage,
});

const PASSWORD_MIN = 8;

const ChangePasswordSchema = v.pipe(
  v.object({
    current_password: v.pipe(v.string(), v.minLength(1, "Escribe tu contraseña actual.")),
    new_password: v.pipe(
      v.string(),
      v.minLength(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres.`),
      v.maxLength(128, "Máximo 128 caracteres."),
    ),
    confirm: v.string(),
  }),
  v.forward(
    v.partialCheck(
      [["new_password"], ["confirm"]],
      (input) => input.new_password === input.confirm,
      "Las contraseñas no coinciden.",
    ),
    ["confirm"],
  ),
);

/** Tras cambiar la contraseña la API cierra todas las sesiones: se vuelve a entrar con la nueva */
async function loginAgain(user: User, password: string) {
  if (user.email) {
    return unwrap(api.POST("/api/v1/auth/login/staff", { body: { email: user.email, password } }));
  }
  if (user.nationality && user.cedula) {
    return unwrap(
      api.POST("/api/v1/auth/login/student", {
        body: { nationality: user.nationality, cedula: user.cedula, password },
      }),
    );
  }
  throw new Error("No se puede volver a iniciar sesión automáticamente.");
}

function ChangePasswordPage() {
  const { user } = Route.useRouteContext();
  const signIn = useSession((s) => s.signIn);
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const forced = user.must_change_password;

  const form = useAppForm({
    defaultValues: { current_password: "", new_password: "", confirm: "" },
    validators: { onSubmit: ChangePasswordSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await unwrap(
          api.POST("/api/v1/auth/change-password", {
            body: { current_password: value.current_password, new_password: value.new_password },
          }),
        );
      } catch (error) {
        if (isApiError(error) && (error.status === 400 || error.status === 401)) {
          form.setFieldMeta("current_password", (meta) => ({
            ...meta,
            errorMap: { ...meta.errorMap, onSubmit: "La contraseña actual no es correcta." },
          }));
          return;
        }
        setFormError(applyApiErrors(form, error));
        return;
      }

      try {
        const token = await loginAgain(user, value.new_password);
        const fresh = await signIn(token.access_token);
        toast.success("Contraseña actualizada.");
        await navigate({ to: homePath(fresh.role), replace: true });
      } catch {
        await signOut();
        toast.info("Contraseña actualizada. Inicia sesión con la nueva.");
        await navigate({ to: "/login", replace: true });
      }
    },
  });

  return (
    <AuthLayout
      title="Cambia tu contraseña"
      description={forced ? "Primer inicio de sesión." : "Elige una contraseña nueva."}
    >
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {forced && (
          <div role="alert" className="alert alert-warning alert-soft mb-2">
            <TriangleAlert className="size-5 shrink-0" />
            <span>Debes cambiar la contraseña generada antes de continuar.</span>
          </div>
        )}
        <FormError message={formError} />
        <form.AppField name="current_password">
          {(field) => (
            <field.TextField
              label="Contraseña actual"
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>
        <form.AppField name="new_password">
          {(field) => (
            <field.TextField
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              hint={`Mínimo ${PASSWORD_MIN} caracteres.`}
            />
          )}
        </form.AppField>
        <form.AppField name="confirm">
          {(field) => (
            <field.TextField
              label="Confirmar nueva contraseña"
              type="password"
              autoComplete="new-password"
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton label="Guardar y continuar" className="mt-4 w-full" />
        </form.AppForm>
        <p className="mt-4 text-base-content/70 text-sm">
          Al cambiarla se cerrarán todas tus sesiones abiertas.
        </p>
        {!forced && (
          <Link to={homePath(user.role)} className="btn btn-ghost mt-2">
            Volver
          </Link>
        )}
      </form>
    </AuthLayout>
  );
}
