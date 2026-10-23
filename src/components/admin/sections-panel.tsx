import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert, UserMinus } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import {
  adminKeys,
  assignSectionStudents,
  createSection,
  deleteSection,
  removeSectionStudent,
  renameSection,
  type SectionRead,
  type SemesterRead,
  type SubjectRead,
  sectionStudentsQuery,
  semesterSectionsQuery,
  usersQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";

const NameSchema = v.object({
  section_name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el nombre."),
    v.maxLength(20, "Máximo 20 caracteres."),
  ),
});

/** "1 estudiante", "3 estudiantes" */
const studentsText = (count: number) => (count === 1 ? "1 estudiante" : `${count} estudiantes`);

/** Las materias del periodo que aún no tienen profesor en la sección */
function withoutTeacher(subjects: SubjectRead[], sectionId: number) {
  return subjects.filter((subject) =>
    subject.section_teachers?.some((t) => t.section_id === sectionId && t.teacher_id == null),
  );
}

/** Cierra el menú «⋯» (daisyUI lo abre con el foco) */
function closeMenu() {
  (document.activeElement as HTMLElement | null)?.blur();
}

/**
 * Pestaña Secciones del periodo: una tarjeta por sección con sus estudiantes y cuántas
 * materias tienen ya profesor en ella. Cada estudiante cursa el periodo en una sola sección
 * (hace falta para matricularlo) y cada materia tiene un único profesor por sección.
 */
export function SectionsPanel({
  semester,
  subjects,
}: {
  semester: SemesterRead;
  /** Todas las materias del periodo, con el profesor de cada sección */
  subjects: SubjectRead[] | undefined;
}) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const sections = useQuery(semesterSectionsQuery(semester.id));
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<SectionRead | null>(null);
  const [viewing, setViewing] = useState<SectionRead | null>(null);
  const closed = semester.is_closed;

  const remove = useMutation({
    mutationFn: (section: SectionRead) => deleteSection(section.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.sections });
      toast.success("Sección eliminada.");
    },
    // 409: tiene estudiantes o profesores
    onError: (error) => toast.error(error.message),
  });

  const handleRemove = async (section: SectionRead) => {
    closeMenu();
    const ok = await confirm({
      title: `¿Eliminar la sección ${section.name}?`,
      message: "Solo se puede eliminar si no tiene estudiantes ni profesores asignados.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate(section);
  };

  if (sections.error) {
    return <ErrorState error={sections.error} onRetry={() => sections.refetch()} />;
  }
  if (!sections.data) return <LoadingState rows={2} />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base-content/70 text-sm">
        Cada estudiante cursa el {period} en una sola sección y cada materia tiene un único profesor
        por sección.
      </p>
      {sections.data.length === 0 && (
        <EmptyState
          title="Sin secciones"
          description="Crea al menos una para poder matricular estudiantes y asignar profesores."
        />
      )}
      <ul
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label={`Secciones de ${semester.name}`}
      >
        {sections.data.map((section) => {
          const missing = subjects ? withoutTeacher(subjects, section.id) : [];
          const total = subjects?.length ?? 0;
          return (
            <li key={section.id} className="card card-border bg-base-100">
              <div className="card-body gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-lg">Sección {section.name}</h3>
                  <div className="dropdown dropdown-end">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-square"
                      aria-label={`Más acciones de la sección ${section.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    <ul className="dropdown-content menu z-10 w-44 rounded-box border border-base-300 bg-base-100 p-1 shadow">
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            closeMenu();
                            setRenaming(section);
                          }}
                        >
                          <Pencil className="size-4" />
                          Renombrar
                        </button>
                      </li>
                      <li className={closed ? "menu-disabled" : ""}>
                        <button
                          type="button"
                          className="text-error"
                          disabled={closed || remove.isPending}
                          onClick={() => handleRemove(section)}
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <p className="text-sm">{studentsText(section.students_count ?? 0)}</p>
                {subjects && (
                  <p className="text-base-content/70 text-sm">
                    {total - missing.length}/{total} materias con profesor
                  </p>
                )}
                {missing.length > 0 && (
                  <p className="flex items-start gap-1 font-semibold text-sm text-warning">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    Sin profesor: {missing.map((s) => s.code).join(", ")}
                  </p>
                )}
                <div className="card-actions mt-1">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setViewing(section)}
                  >
                    Ver estudiantes
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {!closed && (
          <li>
            <button
              type="button"
              className="flex h-full min-h-32 w-full items-center justify-center gap-2 rounded-box border-2 border-base-300 border-dashed font-semibold text-base-content/70 hover:border-primary hover:text-primary"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-5" />
              Nueva sección
            </button>
          </li>
        )}
      </ul>
      {creating && <NewSectionModal semester={semester} onClose={() => setCreating(false)} />}
      {renaming && <RenameSectionModal section={renaming} onClose={() => setRenaming(null)} />}
      {viewing && (
        <SectionStudentsModal section={viewing} closed={closed} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function NewSectionModal({ semester, onClose }: { semester: SemesterRead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { section_name: "" },
    validators: { onSubmit: NameSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const created = await createSection(semester.id, value.section_name.trim());
        await queryClient.invalidateQueries({ queryKey: adminKeys.sections });
        await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
        toast.success(`Sección ${created.name} creada.`);
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open title={`Nueva sección · ${semester.name}`} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <form.AppField name="section_name">
          {(field) => <field.TextField label="Nombre de la sección" placeholder="Ej. A" />}
        </form.AppField>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <form.AppForm>
            <form.SubmitButton label="Crear sección" />
          </form.AppForm>
        </div>
      </form>
    </Modal>
  );
}

function RenameSectionModal({ section, onClose }: { section: SectionRead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { section_name: section.name },
    validators: { onSubmit: NameSchema },
    onSubmit: async ({ value }) => {
      try {
        await renameSection(section.id, value.section_name.trim());
        await queryClient.invalidateQueries({ queryKey: adminKeys.sections });
        await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
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
        <form.AppField name="section_name">
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

/**
 * Estudiantes de una sección: quitar (solo sin matrículas en el periodo) y añadir buscando
 * por nombre o documento. Si el estudiante estaba en otra sección del periodo se cambia
 * (la API lo impide si ya tiene notas en él).
 */
function SectionStudentsModal({
  section,
  closed,
  onClose,
}: {
  section: SectionRead;
  closed: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const students = useQuery(sectionStudentsQuery(section.id));
  const [q, setQ] = useState("");
  const results = useQuery({
    ...usersQuery("students", { q, is_active: true }),
    enabled: !closed && q.trim().length > 0,
  });
  const inSection = new Set(students.data?.map((s) => s.id));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.sections });
    await queryClient.invalidateQueries({ queryKey: adminKeys.users("students") });
  };

  const add = useMutation({
    mutationFn: (studentId: number) => assignSectionStudents(section.id, [studentId]),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        result.moved ? "Estudiante cambiado a esta sección." : "Estudiante añadido a la sección.",
      );
    },
    // 409: ya tiene notas en el periodo en otra sección
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (studentId: number) => removeSectionStudent(section.id, studentId),
    onSuccess: async () => {
      await refresh();
      toast.success("Estudiante quitado de la sección.");
    },
    // 409: está matriculado en materias del periodo
    onError: (error) => toast.error(error.message),
  });

  return (
    <Modal open title={`Sección ${section.name} · estudiantes`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {students.error ? (
          <ErrorState error={students.error} onRetry={() => students.refetch()} />
        ) : !students.data ? (
          <LoadingState rows={2} />
        ) : students.data.length === 0 ? (
          <p className="text-base-content/70 text-sm">Aún no hay estudiantes en esta sección.</p>
        ) : (
          <ul
            className="flex max-h-64 flex-col gap-1 overflow-y-auto"
            aria-label={`Estudiantes de la sección ${section.name}`}
          >
            {students.data.map((student) => (
              <li
                key={student.id}
                className="flex items-center gap-2 rounded-field border border-base-300 px-3 py-1"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{student.full_name}</span>
                  {student.cedula_display && (
                    <span className="text-base-content/60 text-xs">
                      {settings.document_label} {student.cedula_display}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square text-error"
                  aria-label={`Quitar a ${student.full_name}`}
                  disabled={closed || remove.isPending}
                  onClick={() => remove.mutate(student.id)}
                >
                  <UserMinus className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!closed && (
          <div className="flex flex-col gap-2 border-base-300 border-t pt-3">
            <h4 className="font-semibold">Añadir estudiantes</h4>
            <SearchInput value={q} placeholder="Buscar por nombre o documento" onChange={setQ} />
            {results.data && (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {results.data.items.length === 0 && (
                  <li className="text-base-content/70 text-sm">Sin resultados.</li>
                )}
                {results.data.items.map((student) => (
                  <li key={student.id} className="flex items-center gap-2 px-1">
                    <span className="min-w-0 flex-1 truncate">{student.full_name}</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      aria-label={`Añadir a ${student.full_name}`}
                      disabled={inSection.has(student.id) || add.isPending}
                      onClick={() => add.mutate(student.id)}
                    >
                      {inSection.has(student.id) ? "En la sección" : "Añadir"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="modal-action mt-0">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
