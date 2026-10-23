import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import {
  adminKeys,
  createSection,
  deleteSection,
  renameSection,
  type SectionRead,
  type SemesterRead,
  semesterSectionsQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";

// El campo se llama section_name: el id del input es el nombre del campo y el formulario de
// periodos de la misma tarjeta ya usa "name"
const SectionNameSchema = v.object({
  section_name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el nombre."),
    v.maxLength(20, "Máximo 20 caracteres."),
  ),
});

// Otro nombre de campo: el modal convive con el formulario de alta (mismo id de input)
const RenameSchema = v.object({ new_section_name: SectionNameSchema.entries.section_name });

/** Estudiantes de la sección: "1 estudiante", "3 estudiantes" */
const studentsText = (count: number) => (count === 1 ? "1 estudiante" : `${count} estudiantes`);

/**
 * Secciones del periodo seleccionado. Cada estudiante cursa el periodo en una sola sección
 * (hace falta para matricularlo) y cada materia tiene un único profesor por sección.
 */
export function SectionsPanel({ semester }: { semester: SemesterRead }) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const sections = useQuery(semesterSectionsQuery(semester.id));
  const [renaming, setRenaming] = useState<SectionRead | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const closed = semester.is_closed;

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.sections });

  const createForm = useAppForm({
    defaultValues: { section_name: "" },
    validators: { onSubmit: SectionNameSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        const created = await createSection(semester.id, value.section_name.trim());
        await refresh();
        formApi.reset();
        toast.success(`Sección ${created.name} creada.`);
      } catch (error) {
        setFormError(applyApiErrors(createForm, error));
      }
    },
  });

  const remove = useMutation({
    mutationFn: (section: SectionRead) => deleteSection(section.id),
    onSuccess: async () => {
      await refresh();
      toast.success("Sección eliminada.");
    },
    // 409: tiene estudiantes o profesores
    onError: (error) => toast.error(error.message),
  });

  const handleRemove = async (section: SectionRead) => {
    const ok = await confirm({
      title: `¿Eliminar la sección ${section.name}?`,
      message: "Solo se puede eliminar si no tiene estudiantes ni profesores asignados.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate(section);
  };

  return (
    <div className="flex flex-col gap-2 border-base-300 border-t pt-3">
      <h3 className="font-bold">Secciones · {semester.name}</h3>
      <p className="text-base-content/70 text-xs">
        Cada estudiante cursa el {period} en una sola sección y cada materia tiene un único profesor
        por sección.
      </p>
      {sections.error ? (
        <ErrorState error={sections.error} onRetry={() => sections.refetch()} />
      ) : !sections.data ? (
        <LoadingState rows={1} />
      ) : sections.data.length === 0 ? (
        <p className="text-base-content/70 text-sm">
          Sin secciones: crea al menos una para poder matricular estudiantes.
        </p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={`Secciones de ${semester.name}`}>
          {sections.data.map((section) => (
            <li
              key={section.id}
              className="flex items-center gap-2 rounded-field border border-base-300 px-3 py-1"
            >
              <span className="font-semibold">Sección {section.name}</span>
              <span className="flex-1 text-base-content/60 text-xs">
                {section.students_count != null && studentsText(section.students_count)}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                aria-label={`Renombrar sección ${section.name}`}
                onClick={() => setRenaming(section)}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square text-error"
                aria-label={`Eliminar sección ${section.name}`}
                disabled={closed || remove.isPending}
                onClick={() => handleRemove(section)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!closed && (
        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void createForm.handleSubmit();
          }}
        >
          <FormError message={formError} />
          <createForm.AppField name="section_name">
            {(field) => <field.TextField label="Nueva sección" placeholder="Ej. A" />}
          </createForm.AppField>
          <createForm.AppForm>
            <createForm.SubmitButton label="Crear sección" className="btn-outline btn-sm" />
          </createForm.AppForm>
        </form>
      )}
      {renaming && <RenameSectionModal section={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function RenameSectionModal({ section, onClose }: { section: SectionRead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { new_section_name: section.name },
    validators: { onSubmit: RenameSchema },
    onSubmit: async ({ value }) => {
      try {
        await renameSection(section.id, value.new_section_name.trim());
        await queryClient.invalidateQueries({ queryKey: adminKeys.sections });
        toast.success("Sección renombrada.");
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open title="Renombrar sección" onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <form.AppField name="new_section_name">
          {(field) => <field.TextField label="Nombre" />}
        </form.AppField>
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
