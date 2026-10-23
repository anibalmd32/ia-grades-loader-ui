import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { adminKeys, type SemesterRead } from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

const NameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el nombre."),
    v.maxLength(50, "Máximo 50 caracteres."),
  ),
});

/** Resumen del periodo elegido: "5 materias · 2 secciones · 32 estudiantes" */
export type PeriodSummary = { subjects?: number; sections?: number; students?: number };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Cabecera de la pantalla Periodo escolar: selector del periodo con su estado (las reglas
 * congeladas se ven al abrir la etiqueta), cerrar o reabrir, y renombrar o eliminar en el
 * menú «⋯».
 */
export function PeriodBar({
  semesters,
  selected,
  summary,
  onSelect,
}: {
  semesters: SemesterRead[];
  selected: SemesterRead;
  summary: PeriodSummary;
  onSelect: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const [renaming, setRenaming] = useState(false);

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

  const handleToggleClosed = async () => {
    const ok = selected.is_closed
      ? await confirm({
          title: `¿Reabrir el ${period} ${selected.name}?`,
          message:
            "Los profesores podrán volver a cargar y corregir sus notas, y se podrán cambiar sus matrículas y materias. Conservará las reglas de evaluación congeladas al cerrarlo.",
          confirmLabel: "Reabrir",
        })
      : await confirm({
          title: `¿Cerrar el ${period} ${selected.name}?`,
          message: `Se bloquearán sus notas (los profesores ya no podrán cargarlas, corregirlas ni importarlas), sus matrículas y sus materias, y sus reglas de evaluación quedarán congeladas: aunque cambie la configuración académica, el ${period} conservará las de ahora. Podrás reabrirlo si hace falta.`,
          confirmLabel: "Cerrar",
        });
    if (ok) toggleClosed.mutate(selected);
  };

  const handleRemove = async () => {
    closeMenu();
    const ok = await confirm({
      title: `¿Eliminar el ${period} ${selected.name}?`,
      message: "Solo se puede eliminar si no tiene materias.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate(selected);
  };

  const parts = [
    summary.subjects != null && plural(summary.subjects, "materia", "materias"),
    summary.sections != null && plural(summary.sections, "sección", "secciones"),
    summary.students != null && plural(summary.students, "estudiante", "estudiantes"),
  ].filter(Boolean);

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold text-sm">{settings.period_label}</span>
            <select
              className="select min-w-40"
              value={selected.id}
              onChange={(event) => onSelect(Number(event.target.value))}
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.is_closed ? " (cerrado)" : ""}
                </option>
              ))}
            </select>
          </label>
          <PeriodStatus semester={selected} />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={toggleClosed.isPending}
              onClick={handleToggleClosed}
            >
              {selected.is_closed ? (
                <>
                  <LockOpen className="size-4" />
                  Reabrir {period}
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  Cerrar {period}
                </>
              )}
            </button>
            <div className="dropdown dropdown-end">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label={`Más acciones de ${selected.name}`}
              >
                <MoreHorizontal className="size-4" />
              </button>
              <ul className="dropdown-content menu z-10 w-44 rounded-box border border-base-300 bg-base-100 p-1 shadow">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      setRenaming(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    Renombrar
                  </button>
                </li>
                <li>
                  <button type="button" className="text-error" onClick={handleRemove}>
                    <Trash2 className="size-4" />
                    Eliminar
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        {parts.length > 0 && <p className="text-base-content/70 text-sm">{parts.join(" · ")}</p>}
      </div>
      {renaming && <RenamePeriodModal semester={selected} onClose={() => setRenaming(false)} />}
    </section>
  );
}

/** Los menús de daisyUI se abren con el foco: al elegir una opción se cierran quitándolo */
function closeMenu() {
  (document.activeElement as HTMLElement | null)?.blur();
}

/**
 * Estado del periodo: «Abierto» o «Cerrado». Si tiene reglas congeladas, la etiqueta se
 * despliega y las muestra (sirve también al tocarla en el móvil).
 */
function PeriodStatus({ semester }: { semester: SemesterRead }) {
  const badge = semester.is_closed ? (
    <span className="badge gap-1 border-base-content/25 bg-base-content/10 font-semibold text-base-content/80">
      <Lock className="size-3" />
      Cerrado
    </span>
  ) : (
    <span className="badge badge-soft badge-success gap-1 font-semibold">● Abierto</span>
  );
  if (!semester.rules) return <div className="pb-2">{badge}</div>;
  return (
    <details className="dropdown pb-2">
      <summary className="cursor-pointer list-none" title="Ver reglas de evaluación">
        {badge}
      </summary>
      <div className="dropdown-content z-10 mt-2 w-72 rounded-box border border-base-300 bg-base-100 p-3 text-sm shadow">
        {semester.is_closed ? "Reglas congeladas" : "Conserva las reglas de su cierre"}:{" "}
        {semester.rules.summary}.
      </div>
    </details>
  );
}

/** Alta de un periodo (semestre, trimestre…) */
export function NewPeriodModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { name: "" },
    validators: { onSubmit: NameSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const created = await unwrap(
          api.POST("/api/v1/semesters", { body: { name: value.name.trim() } }),
        );
        await queryClient.invalidateQueries({ queryKey: adminKeys.semesters });
        toast.success(`${settings.period_label} ${created.name} creado.`);
        onCreated(created.id);
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open title={`Nuevo ${period}`} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <form.AppField name="name">
          {(field) => <field.TextField label="Nombre" placeholder="Ej. 2027-I" />}
        </form.AppField>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <form.AppForm>
            <form.SubmitButton label={`Crear ${period}`} />
          </form.AppForm>
        </div>
      </form>
    </Modal>
  );
}

function RenamePeriodModal({ semester, onClose }: { semester: SemesterRead; onClose: () => void }) {
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
