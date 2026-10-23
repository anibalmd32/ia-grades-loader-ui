import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminKeys,
  assignSectionStudents,
  type SemesterRead,
  type StudentSectionRead,
  semesterSectionsQuery,
  semestersQuery,
  studentSectionsQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { ClosedBadge } from "@/components/ui/closed-period";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { Section } from "./common";

/**
 * Sección del estudiante en cada periodo. Hace falta para matricularlo en las materias de ese
 * periodo: su profesor en cada materia es el de su sección.
 */
export function StudentSections({ studentId, name }: { studentId: number; name: string }) {
  const settings = useAcademicSettings();
  const semesters = useQuery(semestersQuery);
  const assigned = useQuery(studentSectionsQuery(studentId));

  let content: React.ReactNode;
  if (semesters.error || assigned.error) {
    content = (
      <ErrorState error={semesters.error ?? assigned.error} onRetry={() => assigned.refetch()} />
    );
  } else if (!semesters.data || !assigned.data) {
    content = <LoadingState rows={2} />;
  } else if (semesters.data.length === 0) {
    content = (
      <p className="text-base-content/70 text-sm">
        Aún no hay {settings.period_label_plural.toLowerCase()}.
      </p>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-2">
        {semesters.data.map((semester) => (
          <SemesterSectionRow
            key={semester.id}
            studentId={studentId}
            semester={semester}
            current={assigned.data.find((s) => s.semester_id === semester.id)}
          />
        ))}
      </ul>
    );
  }

  return (
    <Section
      title="Secciones"
      description={`Sección en la que ${name} cursa cada ${settings.period_label.toLowerCase()}. Sin sección no se le puede matricular en sus materias. Solo se cambia mientras no tenga notas en ese ${settings.period_label.toLowerCase()}.`}
    >
      {content}
    </Section>
  );
}

function SemesterSectionRow({
  studentId,
  semester,
  current,
}: {
  studentId: number;
  semester: SemesterRead;
  current: StudentSectionRead | undefined;
}) {
  const settings = useAcademicSettings();
  const queryClient = useQueryClient();
  const sections = useQuery(semesterSectionsQuery(semester.id));

  const assign = useMutation({
    mutationFn: (sectionId: number) => assignSectionStudents(sectionId, [studentId]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.sections });
      toast.success("Sección asignada.");
    },
    // 409: ya tiene notas en el periodo
    onError: (error) => toast.error(error.message),
  });

  const label = `Sección en ${settings.period_label.toLowerCase()} ${semester.name}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-field border border-base-300 px-3 py-2">
      <span className="flex items-center gap-2 font-semibold">
        {settings.period_label} {semester.name}
        {semester.is_closed && <ClosedBadge />}
      </span>
      {sections.data && sections.data.length === 0 ? (
        <span className="text-base-content/60 text-sm">Sin secciones creadas</span>
      ) : (
        <select
          className="select select-sm w-full sm:w-48"
          aria-label={label}
          value={current?.id ?? ""}
          disabled={!sections.data || semester.is_closed || assign.isPending}
          onChange={(event) => {
            if (event.target.value) assign.mutate(Number(event.target.value));
          }}
        >
          <option value="">Sin sección</option>
          {sections.data?.map((section) => (
            <option key={section.id} value={section.id}>
              Sección {section.name}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
