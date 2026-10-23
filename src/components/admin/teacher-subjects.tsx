import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  adminKeys,
  allSubjectsQuery,
  groupBySemester,
  type SemesterRead,
  type SubjectRead,
  semesterSectionsQuery,
  setTeacherSubjects,
  subjectLabel,
  teacherSubjectsQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { Section } from "./common";

/** Clave de una asignación (materia, sección) en el conjunto marcado */
const keyOf = (subjectId: number, sectionId: number) => `${subjectId}:${sectionId}`;

/**
 * Casillas de materias por periodo (semestre…) y sección; guardar reemplaza el conjunto
 * completo del profesor. Cada materia tiene un solo profesor por sección: si otro ya la
 * imparte en esa sección, la API responde 409 y se muestra su mensaje (dice quién).
 */
export function TeacherSubjects({ teacherId }: { teacherId: number }) {
  const settings = useAcademicSettings();
  const queryClient = useQueryClient();
  const subjects = useQuery(allSubjectsQuery);
  const assigned = useQuery(teacherSubjectsQuery(teacherId));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (assigned.data) {
      setSelected(new Set(assigned.data.map((a) => keyOf(a.subject.id, a.section.id))));
    }
  }, [assigned.data]);

  const save = useMutation({
    mutationFn: () =>
      setTeacherSubjects(
        teacherId,
        [...selected].map((key) => {
          const [subject_id, section_id] = key.split(":").map(Number) as [number, number];
          return { subject_id, section_id };
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.teacherSubjects(teacherId) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
      toast.success("Asignación guardada.");
    },
    // 409: otra persona ya imparte la materia en esa sección
    onError: (error) => toast.error(error.message),
  });

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const original = new Set(assigned.data?.map((a) => keyOf(a.subject.id, a.section.id)));
  const dirty = selected.size !== original.size || [...selected].some((k) => !original.has(k));

  let content: React.ReactNode;
  if (subjects.error || assigned.error) {
    content = (
      <ErrorState error={subjects.error ?? assigned.error} onRetry={() => subjects.refetch()} />
    );
  } else if (!subjects.data || !assigned.data) {
    content = <LoadingState rows={3} />;
  } else if (subjects.data.items.length === 0) {
    content = (
      <EmptyState
        title="No hay materias"
        description={`Crea materias en ${settings.period_label_plural} y materias para poder asignarlas.`}
      />
    );
  } else {
    content = (
      <>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {groupBySemester(subjects.data.items).map(({ semester, subjects: list }) => (
            <SemesterSubjects
              key={semester.id}
              semester={semester}
              subjects={list}
              selected={selected}
              onToggle={toggle}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <span className="loading loading-spinner loading-sm" />}
            Guardar asignación
          </button>
        </div>
      </>
    );
  }

  return (
    <Section
      title="Materias que imparte"
      description="Marca las secciones en las que da cada materia: solo cargará notas de los estudiantes de esas secciones. Cada materia tiene un único profesor por sección."
    >
      {content}
    </Section>
  );
}

/** Materias de un periodo con una casilla por cada sección del periodo */
function SemesterSubjects({
  semester,
  subjects,
  selected,
  onToggle,
}: {
  semester: SemesterRead;
  subjects: SubjectRead[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  const settings = useAcademicSettings();
  const sections = useQuery(semesterSectionsQuery(semester.id));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 font-semibold text-base-content/70 text-sm">
        {settings.period_label} {semester.name}
      </legend>
      {sections.error ? (
        <ErrorState error={sections.error} onRetry={() => sections.refetch()} />
      ) : !sections.data ? (
        <LoadingState rows={1} />
      ) : sections.data.length === 0 ? (
        <p className="text-base-content/60 text-sm">
          Sin secciones: créalas para asignar sus materias.
        </p>
      ) : (
        subjects.map((subject) => (
          <div key={subject.id} className="flex flex-col gap-1">
            <span>{subjectLabel(subject)}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
              {sections.data.map((section) => {
                const key = keyOf(subject.id, section.id);
                return (
                  <label key={section.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      aria-label={`${subjectLabel(subject)} · Sección ${section.name}`}
                      checked={selected.has(key)}
                      onChange={() => onToggle(key)}
                    />
                    <span className="text-sm">Sección {section.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))
      )}
    </fieldset>
  );
}
