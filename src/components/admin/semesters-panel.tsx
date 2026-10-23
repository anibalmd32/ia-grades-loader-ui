import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { adminKeys, type SemesterRead, semestersQuery } from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { ClosedBadge } from "@/components/ui/closed-period";
import { confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { SectionsPanel } from "./sections-panel";

const NameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el nombre."),
    v.maxLength(50, "Máximo 50 caracteres."),
  ),
});

/** Lista de periodos (semestres, trimestres…): selección, cerrar o reabrir, renombrar, eliminar y alta */
export function SemestersPanel({
  selectedId,
  onSelect,
}: {
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const semesters = useQuery(semestersQuery);
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const [renaming, setRenaming] = useState<SemesterRead | null>(null);
  const selected = semesters.data?.find((s) => s.id === selectedId);
  const [formError, setFormError] = useState<string | null>(null);

  const createForm = useAppForm({
    defaultValues: { name: "" },
    validators: { onSubmit: NameSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        const created = await unwrap(
          api.POST("/api/v1/semesters", { body: { name: value.name.trim() } }),
        );
        await queryClient.invalidateQueries({ queryKey: adminKeys.semesters });
        formApi.reset();
        toast.success(`${settings.period_label} ${created.name} creado.`);
        onSelect(created.id);
      } catch (error) {
        setFormError(applyApiErrors(createForm, error));
      }
    },
  });

  const remove = useMutation({
    mutationFn: (semester: SemesterRead) =>
      unwrap(
        api.DELETE("/api/v1/semesters/{semester_id}", {
          params: { path: { semester_id: semester.id } },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.semesters });
      toast.success(`${settings.period_label} eliminado.`);
    },
    // 409: tiene materias
    onError: (error) => toast.error(error.message),
  });

  const handleRemove = async (semester: SemesterRead) => {
    const ok = await confirm({
      title: `¿Eliminar el ${period} ${semester.name}?`,
      message: "Solo se puede eliminar si no tiene materias.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate(semester);
  };

  const toggleClosed = useMutation({
    mutationFn: (semester: SemesterRead) => {
      const params = { params: { path: { semester_id: semester.id } } };
      return unwrap(
        semester.is_closed
          ? api.POST("/api/v1/semesters/{semester_id}/reopen", params)
          : api.POST("/api/v1/semesters/{semester_id}/close", params),
      );
    },
    onSuccess: async (saved) => {
      // El estado del periodo viaja dentro de cada materia: refrescar todo lo que las muestra
      await queryClient.invalidateQueries();
      toast.success(
        `${settings.period_label} ${saved.name} ${saved.is_closed ? "cerrado" : "reabierto"}.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const handleToggleClosed = async (semester: SemesterRead) => {
    const ok = semester.is_closed
      ? await confirm({
          title: `¿Reabrir el ${period} ${semester.name}?`,
          message:
            "Los profesores podrán volver a cargar y corregir sus notas, y se podrán cambiar sus matrículas y materias. Conservará las reglas de evaluación congeladas al cerrarlo.",
          confirmLabel: "Reabrir",
        })
      : await confirm({
          title: `¿Cerrar el ${period} ${semester.name}?`,
          message: `Se bloquearán sus notas (los profesores ya no podrán cargarlas, corregirlas ni importarlas), sus matrículas y sus materias, y sus reglas de evaluación quedarán congeladas: aunque cambie la configuración académica, el ${period} conservará las de ahora. Podrás reabrirlo si hace falta.`,
          confirmLabel: "Cerrar",
        });
    if (ok) toggleClosed.mutate(semester);
  };

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title">{settings.period_label_plural}</h2>
        {semesters.error ? (
          <ErrorState error={semesters.error} onRetry={() => semesters.refetch()} />
        ) : !semesters.data ? (
          <LoadingState rows={2} />
        ) : semesters.data.length === 0 ? (
          <p className="text-base-content/70 text-sm">Crea el primer {period} para empezar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {semesters.data.map((semester) => {
              const active = semester.id === selectedId;
              return (
                <li
                  key={semester.id}
                  className={`flex items-center rounded-field border ${active ? "border-primary bg-primary/10" : "border-base-300"}`}
                >
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    className={`flex min-w-0 flex-1 flex-col gap-1 px-3 py-2 text-left ${active ? "text-primary" : ""}`}
                    onClick={() => onSelect(semester.id)}
                  >
                    <span className="flex items-start justify-between gap-2 font-bold">
                      <span className="min-w-0 break-words">{semester.name}</span>
                      {semester.subjects_count != null && (
                        <span className="shrink-0 whitespace-nowrap font-normal text-base-content/60 text-xs leading-6">
                          {semester.subjects_count === 1
                            ? "1 materia"
                            : `${semester.subjects_count} materias`}
                        </span>
                      )}
                    </span>
                    {/* En su propia línea: en la columna estrecha no tapa el nombre */}
                    {semester.is_closed && <ClosedBadge className="self-start" />}
                    {semester.rules && (
                      <span className="text-base-content/70 text-xs">
                        {semester.is_closed
                          ? "Reglas congeladas"
                          : "Conserva las reglas de su cierre"}
                        : {semester.rules.summary}.
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label={`${semester.is_closed ? "Reabrir" : "Cerrar"} ${semester.name}`}
                    title={semester.is_closed ? "Reabrir" : "Cerrar"}
                    disabled={toggleClosed.isPending}
                    onClick={() => handleToggleClosed(semester)}
                  >
                    {semester.is_closed ? (
                      <LockOpen className="size-3.5" />
                    ) : (
                      <Lock className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label={`Renombrar
 ${semester.name}`}
                    onClick={() => setRenaming(semester)}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square text-error"
                    aria-label={`Eliminar ${semester.name}`}
                    onClick={() => handleRemove(semester)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void createForm.handleSubmit();
          }}
        >
          <FormError message={formError} />
          <createForm.AppField name="name">
            {(field) => <field.TextField label={`Nuevo ${period}`} placeholder="Ej. 2027-I" />}
          </createForm.AppField>
          <createForm.AppForm>
            <createForm.SubmitButton label={`Crear ${period}`} className="btn-outline" />
          </createForm.AppForm>
        </form>
        {selected && <SectionsPanel semester={selected} />}
      </div>
      {renaming && <RenameModal semester={renaming} onClose={() => setRenaming(null)} />}
    </section>
  );
}

function RenameModal({ semester, onClose }: { semester: SemesterRead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { name: semester.name },
    validators: { onSubmit: NameSchema },
    onSubmit: async ({ value }) => {
      try {
        await unwrap(
          api.PATCH("/api/v1/semesters/{semester_id}", {
            params: { path: { semester_id: semester.id } },
            body: { name: value.name.trim() },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: adminKeys.semesters });
        await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
        toast.success(`${settings.period_label} renombrado.`);
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open title={`Renombrar ${settings.period_label.toLowerCase()}`} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <form.AppField name="name">{(field) => <field.TextField label="Nombre" />}</form.AppField>
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
