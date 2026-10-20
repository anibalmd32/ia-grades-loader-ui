import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { setupStatusQuery } from "@/api/queries/setup";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import {
  FIRST_NAME_FIELD,
  firstNameSchema,
  LAST_NAME_FIELD,
  lastNameSchema,
  PersonNameRow,
} from "@/components/form/person-name";
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
    first_name: firstNameSchema,
    last_name: lastNameSchema,
    email: v.pipe(v.string(), v.trim(), v.email("Escribe un email válido.")),
    password: v.pipe(
      v.string(),
      v.minLength(PASSWORD_MIN, `Mínimo ${PASSWORD_MIN} caracteres.`),
      v.maxLength(128, "Máximo 128 caracteres."),
    ),
    confirm: v.string(),
    setup_token: v.pipe(v.string(), v.trim()),
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
  // En producción el servidor pide el código de instalación (SETUP_TOKEN)
  const tokenRequired = useQuery(setupStatusQuery).data?.token_required ?? false;

  const form = useAppForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      confirm: "",
      setup_token: "",
    },
    validators: { onSubmit: SetupSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      if (tokenRequired && !value.setup_token) {
        form.setFieldMeta("setup_token", (meta) => ({
          ...meta,
          errorMap: { onSubmit: "Escribe el código de instalación." },
        }));
        return;
      }
      try {
        const token = await unwrap(
          api.POST("/api/v1/setup", {
            body: {
              first_name: value.first_name.trim(),
              last_name: value.last_name.trim(),
              email: value.email.trim(),
              password: value.password,
            },
            headers: tokenRequired ? { "X-Setup-Token": value.setup_token } : undefined,
          }),
        );
        queryClient.setQueryData(setupStatusQuery.queryKey, {
          installed: true,
          token_required: tokenRequired,
        });
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
        {tokenRequired && (
          <form.AppField name="setup_token">
            {(field) => (
              <field.TextField
                label="Código de instalación"
                type="password"
                autoComplete="off"
                hint="Lo define quien administra el servidor (variable SETUP_TOKEN)."
              />
            )}
          </form.AppField>
        )}
        <PersonNameRow
          firstName={
            <form.AppField name="first_name">
              {(field) => <field.TextField {...FIRST_NAME_FIELD} placeholder="Ej. Anibal" />}
            </form.AppField>
          }
          lastName={
            <form.AppField name="last_name">
              {(field) => <field.TextField {...LAST_NAME_FIELD} placeholder="Ej. Torres" />}
            </form.AppField>
          }
        />
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
