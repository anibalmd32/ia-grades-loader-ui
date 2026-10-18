import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Info, Plus } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import {
  type AccountKind,
  accountIdentity,
  adminKeys,
  createAccount,
  resetPassword,
  type UserRead,
  updateAccount,
  usersQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import {
  cedulaSchema,
  DocumentRow,
  documentNoun,
  nationalitySchema,
  useDocumentFields,
} from "@/components/form/document-fields";
import { FormError, useAppForm } from "@/components/form/form";
import {
  FIRST_NAME_FIELD,
  firstNameSchema,
  LAST_NAME_FIELD,
  lastNameSchema,
  PersonNameRow,
} from "@/components/form/person-name";
import { Avatar } from "@/components/ui/avatar";
import { confirm } from "@/components/ui/confirm";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "@/components/ui/toast";
import { STATUS_OPTIONS, StatusBadge, type StatusFilter, statusToParam } from "./common";
import { showGeneratedPassword } from "./generated-password";

export const ACCOUNTS: Record<
  AccountKind,
  {
    title: string;
    description: string;
    singular: string;
    newLabel: string;
    created: string;
    listPath: "/admin/coordinators" | "/admin/teachers" | "/admin/students";
    searchPlaceholder: string;
  }
> = {
  coordinators: {
    title: "Coordinadores",
    description: "Crea y gestiona las cuentas de coordinación.",
    singular: "Coordinador",
    newLabel: "Nuevo coordinador",
    created: "Coordinador creado correctamente.",
    listPath: "/admin/coordinators",
    searchPlaceholder: "Buscar por nombre o email",
  },
  teachers: {
    title: "Profesores",
    description: "Crea cuentas y asígnales materias.",
    singular: "Profesor",
    newLabel: "Nuevo profesor",
    created: "Profesor creado correctamente.",
    listPath: "/admin/teachers",
    searchPlaceholder: "Buscar por nombre o email",
  },
  students: {
    title: "Estudiantes",
    description: "Crea cuentas y matricúlalos en materias.",
    singular: "Estudiante",
    newLabel: "Nuevo estudiante",
    created: "Estudiante creado correctamente.",
    listPath: "/admin/students",
    // La lista de estudiantes usa el nombre del documento configurado
    searchPlaceholder: "Buscar por nombre",
  },
};

/** Parámetros de búsqueda de las listas de cuentas (?q=&status=&offset=) */
export const AccountsSearchSchema = v.object({
  q: v.optional(v.fallback(v.string(), ""), ""),
  status: v.optional(v.fallback(v.picklist(["active", "inactive", "all"]), "active"), "active"),
  offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
});
export type AccountsSearch = v.InferOutput<typeof AccountsSearchSchema>;
/** Valores por defecto: no se escriben en la URL */
export const ACCOUNTS_SEARCH_DEFAULTS = { q: "", status: "active", offset: 0 } as const;

export function NewAccountButton({ kind }: { kind: AccountKind }) {
  return (
    <Link to={`${ACCOUNTS[kind].listPath}/new`} className="btn btn-primary">
      <Plus className="size-4" />
      {ACCOUNTS[kind].newLabel}
    </Link>
  );
}

export function AccountsList({
  kind,
  search,
  onSearchChange,
}: {
  kind: AccountKind;
  search: AccountsSearch;
  onSearchChange: (patch: Partial<AccountsSearch>) => void;
}) {
  const navigate = useNavigate();
  const config = ACCOUNTS[kind];
  const documentLabel = useAcademicSettings().document_label;
  const query = useQuery(
    usersQuery(kind, {
      q: search.q,
      is_active: statusToParam(search.status),
      offset: search.offset,
    }),
  );
  const detailPath = `${config.listPath}/$userId` as const;
  const openDetail = (user: UserRead) => navigate({ to: detailPath, params: { userId: user.id } });

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search.q}
          placeholder={
            kind === "students"
              ? `Buscar por nombre o ${documentNoun(documentLabel)}`
              : config.searchPlaceholder
          }
          onChange={(q) => onSearchChange({ q, offset: 0 })}
        />
        <select
          className="select w-full sm:w-52"
          aria-label="Filtrar por estado"
          value={search.status}
          onChange={(event) =>
            onSearchChange({ status: event.target.value as StatusFilter, offset: 0 })
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        rows={query.data?.items}
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => query.refetch()}
        rowKey={(user) => user.id}
        emptyTitle={
          search.q ? "Sin resultados para la búsqueda" : `Aún no hay ${config.title.toLowerCase()}`
        }
        page={query.data}
        onPageChange={(offset) => onSearchChange({ offset })}
        onRowClick={openDetail}
        columns={[
          {
            header: "Nombre",
            cell: (user) => <span className="font-medium">{user.full_name}</span>,
          },
          {
            header: kind === "students" ? documentLabel : "Email",
            cell: (user) => (kind === "students" ? user.cedula_display : user.email),
          },
          // Coordinadores no tienen materias (la API devuelve null)
          ...(kind === "coordinators"
            ? []
            : [
                { header: "Materias", cell: (user: UserRead) => subjectsText(user.subjects_count) },
              ]),
          { header: "Estado", cell: (user) => <StatusBadge active={user.is_active} /> },
          {
            header: "Acciones",
            cell: (user) => (
              <Link
                to={detailPath}
                params={{ userId: user.id }}
                className="link link-primary font-bold no-underline"
              >
                Ver detalle
              </Link>
            ),
          },
        ]}
        renderCard={(user) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold">{user.full_name}</p>
              <p className="truncate text-base-content/70 text-sm">
                {[
                  kind === "students" ? user.cedula_display : user.email,
                  kind === "coordinators" ? null : subjectsText(user.subjects_count),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <StatusBadge active={user.is_active} />
          </div>
        )}
      />
    </>
  );
}

/** "3 materias", "1 materia" o "Sin materias" (recuento de la API) */
export function subjectsText(count: number | null | undefined): string {
  if (count == null) return "";
  if (count === 0) return "Sin materias";
  return count === 1 ? "1 materia" : `${count} materias`;
}

/** Tarjeta de cabecera del detalle: datos y acciones (editar, restablecer contraseña, activar) */
export function AccountHeader({ kind, user }: { kind: AccountKind; user: UserRead }) {
  const queryClient = useQueryClient();
  const documentLabel = useAcademicSettings().document_label;
  const [editing, setEditing] = useState(false);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.users(kind) });

  const toggleActive = useMutation({
    mutationFn: () => updateAccount(kind, user.id, { is_active: !user.is_active }),
    onSuccess: async (updated) => {
      await invalidate();
      toast.success(updated.is_active ? "Cuenta activada." : "Cuenta desactivada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const reset = useMutation({
    mutationFn: () => resetPassword(kind, user.id),
    onSuccess: ({ generated_password }) =>
      showGeneratedPassword({
        message: "Contraseña restablecida. Se cerraron sus sesiones abiertas.",
        account: `${user.full_name} · ${accountIdentity(user, documentLabel)}`,
        password: generated_password,
      }),
    onError: (error) => toast.error(error.message),
  });

  const handleToggle = async () => {
    const ok = await confirm(
      user.is_active
        ? {
            title: `¿Desactivar a ${user.full_name}?`,
            message:
              "No podrá iniciar sesión hasta que la vuelvas a activar. Sus datos se conservan.",
            confirmLabel: "Desactivar",
            danger: true,
          }
        : { title: `¿Activar a ${user.full_name}?`, confirmLabel: "Activar" },
    );
    if (ok) toggleActive.mutate();
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "¿Restablecer la contraseña?",
      message: `Se generará una contraseña nueva para ${user.full_name} y se cerrarán todas sus sesiones.`,
      confirmLabel: "Restablecer",
    });
    if (ok) reset.mutate();
  };

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-4">
          <Avatar person={user} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-2xl">{user.full_name}</h2>
              <StatusBadge active={user.is_active} />
            </div>
            <p className="text-base-content/70 text-sm">{accountIdentity(user, documentLabel)}</p>
            {kind === "students" && (
              <p className="text-base-content/70 text-sm">
                {user.telegram_linked ? "Telegram vinculado" : "Telegram sin vincular"}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            type="button"
            className="btn btn-outline btn-primary"
            disabled={reset.isPending}
            onClick={handleReset}
          >
            Restablecer contraseña
          </button>
          <button
            type="button"
            className={`btn btn-outline ${user.is_active ? "btn-error" : "btn-success"}`}
            disabled={toggleActive.isPending}
            onClick={handleToggle}
          >
            {user.is_active ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
      <EditAccountModal kind={kind} user={user} open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

const emailSchema = v.pipe(v.string(), v.trim(), v.email("Escribe un email válido."));

const StaffSchema = v.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  email: emailSchema,
});
const StudentEditSchema = v.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  nationality: nationalitySchema,
  cedula: cedulaSchema,
});

function EditAccountModal({
  kind,
  user,
  open,
  onClose,
}: {
  kind: AccountKind;
  user: UserRead;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const isStudent = kind === "students";
  const documentFields = useDocumentFields();

  const form = useAppForm({
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email ?? "",
      nationality: user.nationality ?? "",
      cedula: user.cedula ? String(user.cedula) : "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const result = v.safeParse(isStudent ? StudentEditSchema : StaffSchema, value);
        if (result.success) return undefined;
        return {
          fields: Object.fromEntries(result.issues.map((i) => [v.getDotPath(i), i.message])),
        };
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await updateAccount(
          kind,
          user.id,
          isStudent
            ? {
                first_name: value.first_name.trim(),
                last_name: value.last_name.trim(),
                nationality: value.nationality,
                cedula: Number(value.cedula),
              }
            : {
                first_name: value.first_name.trim(),
                last_name: value.last_name.trim(),
                email: value.email.trim(),
              },
        );
        await queryClient.invalidateQueries({ queryKey: adminKeys.users(kind) });
        toast.success("Datos actualizados.");
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open={open} title={`Editar ${ACCOUNTS[kind].singular.toLowerCase()}`} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <PersonNameRow
          firstName={
            <form.AppField name="first_name">
              {(field) => <field.TextField {...FIRST_NAME_FIELD} />}
            </form.AppField>
          }
          lastName={
            <form.AppField name="last_name">
              {(field) => <field.TextField {...LAST_NAME_FIELD} />}
            </form.AppField>
          }
        />
        {isStudent ? (
          <DocumentRow
            nationality={
              <form.AppField name="nationality">
                {(field) => <field.SelectField {...documentFields.nationality} />}
              </form.AppField>
            }
            cedula={
              <form.AppField name="cedula">
                {(field) => <field.TextField {...documentFields.cedula} />}
              </form.AppField>
            }
          />
        ) : (
          <form.AppField name="email">
            {(field) => <field.TextField label="Email" type="email" />}
          </form.AppField>
        )}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <form.AppForm>
            <form.SubmitButton label="Guardar" />
          </form.AppForm>
        </div>
      </form>
    </Modal>
  );
}

export function GeneratedPasswordNotice() {
  return (
    <div role="note" className="alert alert-soft">
      <Info className="size-5 shrink-0" />
      <span>Se generará una contraseña aleatoria que verás una sola vez.</span>
    </div>
  );
}

/** Alta de coordinador o profesor (nombre + email) */
export function StaffCreateForm({ kind }: { kind: "coordinators" | "teachers" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const config = ACCOUNTS[kind];
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { first_name: "", last_name: "", email: "" },
    validators: { onSubmit: StaffSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const { user, generated_password } = await createAccount(kind, {
          first_name: value.first_name.trim(),
          last_name: value.last_name.trim(),
          email: value.email.trim(),
        });
        await queryClient.invalidateQueries({ queryKey: adminKeys.users(kind) });
        showGeneratedPassword({
          message: config.created,
          account: `${user.full_name} · ${user.email}`,
          password: generated_password,
        });
        await navigate({ to: config.listPath });
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <form
      noValidate
      className="card card-border w-full max-w-xl bg-base-100"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="card-body gap-2">
        <FormError message={formError} />
        <PersonNameRow
          firstName={
            <form.AppField name="first_name">
              {(field) => <field.TextField {...FIRST_NAME_FIELD} placeholder="Ej. José" />}
            </form.AppField>
          }
          lastName={
            <form.AppField name="last_name">
              {(field) => <field.TextField {...LAST_NAME_FIELD} placeholder="Ej. Méndez" />}
            </form.AppField>
          }
        />
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="Email"
              type="email"
              placeholder="nombre@universidad.edu"
              hint="Lo usará para iniciar sesión. Debe ser único."
            />
          )}
        </form.AppField>
        <GeneratedPasswordNotice />
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to={config.listPath} className="btn btn-outline btn-primary">
            Cancelar
          </Link>
          <form.AppForm>
            <form.SubmitButton label={`Crear ${config.singular.toLowerCase()}`} />
          </form.AppForm>
        </div>
      </div>
    </form>
  );
}
