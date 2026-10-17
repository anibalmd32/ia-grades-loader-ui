import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as v from "valibot";
import { type StudentSubjectGrades, studentOverviewQuery } from "@/api/queries/student";
import { summaryOf } from "@/components/student/projection";
import { SubjectGradesCard } from "@/components/student/subject-grades-card";
import { formatGrade } from "@/components/ui/grade-badge";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const title = "Mis notas";
const description = "Tus notas por lapso en cada materia.";

export const Route = createFileRoute("/_app/student/grades/")({
  validateSearch: v.object({
    semester: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
  }),
  staticData: { title, description },
  component: StudentGradesPage,
});

/** Semestres de mis materias, el más reciente primero */
function semestersOf(subjects: StudentSubjectGrades[]) {
  const map = new Map(subjects.map((s) => [s.subject.semester.id, s.subject.semester]));
  return [...map.values()].sort((a, b) => b.id - a.id);
}

function StudentGradesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const overview = useQuery(studentOverviewQuery);

  const subjects = overview.data?.subjects ?? [];
  const semesters = semestersOf(subjects);
  const semester = semesters.find((s) => s.id === search.semester) ?? semesters[0];
  const visible = subjects.filter((s) => s.subject.semester.id === semester?.id);
  const summary = summaryOf(visible);

  const ask = (
    <Link to="/student/assistant" className="btn btn-outline btn-primary">
      Pregúntale al asistente
    </Link>
  );

  return (
    <>
      <PageHeader
        title={title}
        description={
          semester
            ? `Semestre ${semester.name} · ${visible.length} ${visible.length === 1 ? "materia" : "materias"}`
            : description
        }
        actions={subjects.length > 0 ? ask : undefined}
      />
      <PullToRefresh onRefresh={() => overview.refetch()}>
        <PageBody>
          {overview.error ? (
            <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
          ) : !overview.data ? (
            <LoadingState rows={4} />
          ) : subjects.length === 0 ? (
            <EmptyState
              title="Aún no estás matriculado en ninguna materia"
              description="Cuando la coordinación te matricule, verás aquí tus notas."
            />
          ) : (
            <>
              {semesters.length > 1 && (
                <select
                  className="select w-full sm:max-w-56"
                  aria-label="Semestre"
                  value={semester?.id}
                  onChange={(event) =>
                    navigate({ search: { semester: Number(event.target.value) }, replace: true })
                  }
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      Semestre {s.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Promedio general" value={formatGrade(overview.data.average)} />
                <Stat label="Aprobadas" value={summary.approved} className="text-success" />
                <Stat label="En curso" value={summary.inProgress} className="text-primary" />
                <Stat label="En riesgo" value={summary.atRisk} className="text-error" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {visible.map((item) => (
                  <SubjectGradesCard key={item.subject.id} item={item} />
                ))}
              </div>

              <p className="text-base-content/70 text-xs">
                Los 3 lapsos pesan igual. La definitiva es el promedio simple y se aprueba con 10.
              </p>
            </>
          )}
        </PageBody>
      </PullToRefresh>
    </>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body gap-0 p-4">
        <p className={`font-bold text-2xl tabular-nums lg:text-3xl ${className}`}>{value}</p>
        <p className="text-base-content/70 text-sm">{label}</p>
      </div>
    </div>
  );
}
