import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { setupStatusQuery } from "@/api/queries/setup";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { AuthLayout } from "@/components/layout/auth-layout";
import { homePath } from "@/lib/roles";
import { useSession } from "@/stores/session";

// Instalador: solo existe mientras no haya super admin
export const Route = createFileRoute("/setup")({
  beforeLoad: async ({ context }) => {
    const { installed } = await context.queryClient.ensureQueryData(setupStatusQuery);
    if (installed) throw redirect({ to: "/login" });
  },
  component: SetupPage,
});

const PASSWORD_MIN = 8;

const SetupSchema = v.pipe(
  v.object({
    full_name: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(3, "Escribe el nombre completo."),
      v.maxLength(150, "Máximo 150 caracteres."),
    ),
    email: v.pipe(v.string(), v.trim(), v.email("Escribe un email válido.")),
    password: v.pipe(
      v.string(),
      v.minLength(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres.`),
      v.maxLength(128, "Máximo 128 caracteres."),
    ),
    confirm: v.string(),
  }),
  v.forward(
    v.partialCheck(
      [["password"], ["confirm"]],
      (input) => input.password === input.confirm,
      "Las contraseñas no coinciden.",
    ),
    ["confirm"],
  ),
);

function SetupPage() {
  const navigate = useNavigate();
  const signIn = useSession((s) => s.signIn);
  const queryClient = Route.useRouteContext({ select: (c) => c.queryClient });
  const [formError, setFormError] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(true);

  const form = useAppForm({
    defaultValues: { full_name: "", email: "", password: "", confirm: "" },
    validators: { onSubmit: SetupSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const token = await unwrap(
          api.POST("/api/v1/setup", {
            body: {
              full_name: value.full_name.trim(),
              email: value.email.trim(),
              password: value.password,
            },
          }),
        );
        queryClient.setQueryData(setupStatusQuery.queryKey, { installed: true });
        const user = await signIn(token.access_token);
        await navigate({ to: homePath(user.role), replace: true });
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <AuthLayout
      title="Instala el sistema"
      description="Crea la cuenta de super admin para empezar."
    >
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {showNotice && (
          <div role="note" className="alert alert-soft mb-2">
            <Info className="size-5 shrink-0" />
            <span>Este paso solo aparece una vez: la cuenta será el único super admin.</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              aria-label="Cerrar aviso"
              onClick={() => setShowNotice(false)}
            >
              ✕
            </button>
          </div>
        )}
        <FormError message={formError} />
        <form.AppField name="full_name">
          {(field) => (
            <field.TextField
              label="Nombre completo"
              placeholder="Ej. Anibal Torres"
              autoComplete="name"
            />
          )}
        </form.AppField>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="Email"
              type="email"
              placeholder="admin@universidad.edu"
              autoComplete="email"
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              hint={`Mínimo ${PASSWORD_MIN} caracteres.`}
            />
          )}
        </form.AppField>
        <form.AppField name="confirm">
          {(field) => (
            <field.TextField
              label="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton label="Crear super admin" className="mt-4 w-full" />
        </form.AppForm>
      </form>
    </AuthLayout>
  );
}
