import { Link } from "@tanstack/react-router";
import { useAcademicSettings } from "@/api/queries/settings";
import type { TeacherSubject } from "@/api/queries/teacher";
import { termName, termNumbers } from "@/lib/grades";

/** Tarjeta de "Mis materias": estudiantes, notas cargadas por lapso y accesos */
export function SubjectCard({ subject }: { subject: TeacherSubject }) {
  const settings = useAcademicSettings();
  const total = subject.students_count;

  return (
    <article className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-primary text-sm">{subject.code}</span>
          <span className="badge badge-ghost badge-sm font-semibold">
            {settings.period_label} {subject.semester.name}
          </span>
        </div>
        <h2 className="card-title text-xl">{subject.name}</h2>
        <p className="text-base-content/70 text-sm">
          {total} {total === 1 ? "estudiante matriculado" : "estudiantes matriculados"}
        </p>

        <ul className="flex flex-col gap-2">
          {termNumbers(settings).map((term) => {
            // Recuento de la API (una clave por lapso configurado): no hace falta cargar la planilla
            const loaded = subject.grades_count[String(term)] ?? 0;
            const complete = total > 0 && loaded === total;
            const name = termName(settings, term);
            return (
              <li key={term} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">{name}</span>
                  <span
                    className={complete ? "font-semibold text-success" : "text-base-content/70"}
                  >
                    {loaded}/{total} notas
                  </span>
                </div>
                <progress
                  className={`progress h-1.5 ${complete ? "progress-success" : "progress-primary"}`}
                  value={loaded}
                  max={Math.max(total, 1)}
                  aria-label={`${name}: ${loaded} de ${total} notas`}
                />
              </li>
            );
          })}
        </ul>

        <div className="card-actions mt-1 grid grid-cols-2 gap-2">
          <Link
            to="/teacher/subjects/$subjectId"
            params={{ subjectId: subject.id }}
            className="btn btn-primary"
          >
            Cargar notas
          </Link>
          <Link
            to="/teacher/imports"
            search={{ subject: subject.id }}
            className="btn btn-outline btn-primary"
          >
            Importar Excel
          </Link>
        </div>
      </div>
    </article>
  );
}
