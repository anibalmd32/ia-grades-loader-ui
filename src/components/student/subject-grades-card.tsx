import { Link } from "@tanstack/react-router";
import { type AcademicSettings, useSubjectRules } from "@/api/queries/settings";
import type { StudentSubjectGrades } from "@/api/queries/student";
import { AbsentBadge } from "@/components/ui/grade-badge";
import { formatGrade, isPassing, termName } from "@/lib/grades";
import { StandingBadge, standingSentence } from "./projection";

/** Color de una nota: atenuada si falta, en rojo si no llega a la aprobatoria */
export function gradeColor(value: number | null | undefined, settings: AcademicSettings): string {
  if (value == null) return "text-base-content/30";
  return isPassing(value, settings) ? "" : "text-error";
}

/** "Prof. Ana Pérez · Sección A": el único profesor de la materia en la sección del estudiante */
export function teacherText(item: Pick<StudentSubjectGrades, "teacher" | "section">): string {
  return [
    item.teacher ? `Prof. ${item.teacher}` : "Sin profesor asignado",
    item.section ? `Sección ${item.section}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Recuadro de una nota: "Lapso 1 · 15.75" (o "I" si fue inasistente) */
export function GradeBox({
  label,
  value,
  absent = false,
  settings,
}: {
  label: string;
  value: number | null;
  absent?: boolean;
  settings: AcademicSettings;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-field bg-base-200 px-2 py-2">
      <span className="text-base-content/70 text-xs">{label}</span>
      {absent ? (
        <span className="py-0.5">
          <AbsentBadge short rules={settings} />
        </span>
      ) : (
        <span className={`font-bold text-lg tabular-nums ${gradeColor(value, settings)}`}>
          {formatGrade(value, settings)}
        </span>
      )}
    </div>
  );
}

/** Tarjeta de "Mis notas": lapsos, promedio o definitiva y situación de la materia */
export function SubjectGradesCard({ item }: { item: StudentSubjectGrades }) {
  // Cada materia se presenta con las reglas de su periodo (congeladas si se cerró alguna vez)
  const settings = useSubjectRules(item.subject.semester);
  const { subject, projection } = item;
  const final = projection.final_grade;

  return (
    <Link
      to="/student/grades/$subjectId"
      params={{ subjectId: subject.id }}
      className="card card-border bg-base-100 transition-shadow hover:shadow-md"
    >
      <div className="card-body gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-primary text-xs">{subject.code}</p>
            <h2 className="truncate font-bold text-lg">{subject.name}</h2>
            <p className="truncate text-base-content/60 text-xs">{teacherText(item)}</p>
          </div>
          <StandingBadge projection={projection} settings={settings} />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(3.75rem,1fr))] gap-2">
          {item.grades.map((g) => (
            <GradeBox
              key={g.term}
              label={termName(settings, g.term)}
              value={g.value}
              absent={g.absent}
              settings={settings}
            />
          ))}
          <div className="flex flex-col items-center gap-0.5 rounded-field bg-neutral px-2 py-2 text-neutral-content">
            <span className="text-neutral-content/70 text-xs">
              {final != null ? "Definitiva" : "Promedio"}
            </span>
            <span className="font-bold text-lg tabular-nums">
              {formatGrade(final ?? item.average, settings)}
            </span>
          </div>
        </div>

        <p className="text-base-content/70 text-sm">{standingSentence(projection, settings)}</p>
      </div>
    </Link>
  );
}
