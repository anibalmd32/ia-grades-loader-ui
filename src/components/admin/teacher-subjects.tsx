import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  adminKeys,
  allSubjectsQuery,
  groupBySemester,
  setTeacherSubjects,
  subjectLabel,
  teacherSubjectsQuery,
} from "@/api/queries/admin";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { Section } from "./common";

/** Casillas de materias por semestre; guardar reemplaza el conjunto completo del profesor */
export function TeacherSubjects({ teacherId }: { teacherId: number }) {
  const queryClient = useQueryClient();
  const subjects = useQuery(allSubjectsQuery);
  const assigned = useQuery(teacherSubjectsQuery(teacherId));
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (assigned.data) setSelected(new Set(assigned.data.map((s) => s.id)));
  }, [assigned.data]);

  const save = useMutation({
    mutationFn: () => setTeacherSubjects(teacherId, [...selected]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.teacherSubjects(teacherId) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
      toast.success("Asignación guardada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const original = new Set(assigned.data?.map((s) => s.id));
  const dirty = selected.size !== original.size || [...selected].some((id) => !original.has(id));

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
        description="Crea materias en Semestres y materias para poder asignarlas."
      />
    );
  } else {
    content = (
      <>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {groupBySemester(subjects.data.items).map(({ semester, subjects: list }) => (
            <fieldset key={semester.id} className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold text-base-content/70 text-sm">
                Semestre {semester.name}
              </legend>
              {list.map((subject) => (
                <label key={subject.id} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={selected.has(subject.id)}
                    onChange={() => toggle(subject.id)}
                  />
                  <span>{subjectLabel(subject)}</span>
                </label>
              ))}
            </fieldset>
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
      description="Solo podrá cargar notas en las materias marcadas."
    >
      {content}
    </Section>
  );
}
