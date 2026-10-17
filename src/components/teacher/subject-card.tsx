import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { gradeOf, subjectGradesQuery, TERMS, type TeacherSubject } from "@/api/queries/teacher";

/** Tarjeta de "Mis materias": estudiantes, notas cargadas por lapso y accesos */
export function SubjectCard({ subject }: { subject: TeacherSubject }) {
  // Misma consulta que la planilla: al abrirla ya está en caché
  const grades = useQuery(subjectGradesQuery(subject.id));
  const total = subject.students_count;

  return (
    <article className="card card-border bg-base-100">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-primary text-sm">{subject.code}</span>
          <span className="badge badge-ghost badge-sm font-semibold">
            Semestre {subject.semester.name}
          </span>
        </div>
        <h2 className="card-title text-xl">{subject.name}</h2>
        <p className="text-base-content/70 text-sm">
          {total} {total === 1 ? "estudiante matriculado" : "estudiantes matriculados"}
        </p>

        <ul className="flex flex-col gap-2">
          {TERMS.map((term) => {
            const loaded = grades.data?.students.filter((s) => gradeOf(s, term) != null).length;
            const complete = total > 0 && loaded === total;
            return (
              <li key={term} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">Lapso {term}</span>
                  <span
                    className={complete ? "font-semibold text-success" : "text-base-content/70"}
                  >
                    {loaded ?? (grades.error ? "—" : "…")}/{total} notas
                  </span>
                </div>
                <progress
                  className={`progress h-1.5 ${complete ? "progress-success" : "progress-primary"}`}
                  value={loaded ?? 0}
                  max={Math.max(total, 1)}
                  aria-label={`Lapso ${term}: ${loaded ?? 0} de ${total} notas`}
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
