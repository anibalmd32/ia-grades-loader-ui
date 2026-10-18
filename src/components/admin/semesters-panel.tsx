import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import { adminKeys, type SemesterRead, semestersQuery } from "@/api/queries/admin";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";

const NameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el nombre del semestre."),
    v.maxLength(50, "Máximo 50 caracteres."),
  ),
});

/** Lista de semestres (selección, renombrar, eliminar) y alta de semestre */
export function SemestersPanel({
  selectedId,
  onSelect,
}: {
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const semesters = useQuery(semestersQuery);
  const [renaming, setRenaming] = useState<SemesterRead | null>(null);
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
        toast.success(`Semestre ${created.name} creado.`);
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
      toast.success("Semestre eliminado.");
    },
    // 409: tiene materias
    onError: (error) => toast.error(error.message),
  });

  const handleRemove = async (semester: SemesterRead) => {
    const ok = await confirm({
      title: `¿Eliminar el semestre ${semester.name}?`,
      message: "Solo se puede eliminar si no tiene materias.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate(semester);
  };

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title">Semestres</h2>
        {semesters.error ? (
          <ErrorState error={semesters.error} onRetry={() => semesters.refetch()} />
        ) : !semesters.data ? (
          <LoadingState rows={2} />
        ) : semesters.data.length === 0 ? (
          <p className="text-base-content/70 text-sm">Crea el primer semestre para empezar.</p>
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
                    className={`flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left font-bold ${active ? "text-primary" : ""}`}
                    onClick={() => onSelect(semester.id)}
                  >
                    {semester.name}
                    {semester.subjects_count != null && (
                      <span className="font-normal text-base-content/60 text-xs">
                        {semester.subjects_count === 1
                          ? "1 materia"
                          : `${semester.subjects_count} materias`}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label={`Renombrar ${semester.name}`}
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
            {(field) => <field.TextField label="Nuevo semestre" placeholder="Ej. 2027-I" />}
          </createForm.AppField>
          <createForm.AppForm>
            <createForm.SubmitButton label="Crear semestre" className="btn-outline" />
          </createForm.AppForm>
        </form>
      </div>
      {renaming && <RenameModal semester={renaming} onClose={() => setRenaming(null)} />}
    </section>
  );
}

function RenameModal({ semester, onClose }: { semester: SemesterRead; onClose: () => void }) {
  const queryClient = useQueryClient();
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
        toast.success("Semestre renombrado.");
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open title="Renombrar semestre" onClose={onClose}>
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
