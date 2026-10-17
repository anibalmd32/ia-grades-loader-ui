import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as v from "valibot";
import { type StudentSubjectGrades, studentSubjectQuery } from "@/api/queries/student";
import { BackLink } from "@/components/admin/common";
import { StandingBadge, standingSentence, termsText } from "@/components/student/projection";
import { formatGrade, PASSING_GRADE } from "@/components/ui/grade-badge";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_app/student/grades/$subjectId")({
  params: {
    parse: ({ subjectId }) => ({
      subjectId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), subjectId),
    }),
    stringify: ({ subjectId }) => ({ subjectId: String(subjectId) }),
  },
  staticData: { title: "Detalle de materia" },
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const query = useQuery(studentSubjectQuery(subjectId));
  const item = query.data;

  return (
    <>
      <PageHeader
        title={item ? `${item.subject.code} · ${item.subject.name}` : "Materia"}
        description={
          item
            ? [`Semestre ${item.subject.semester.name}`, ...item.teachers.map((t) => `Prof. ${t}`)]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />
      <PageBody>
        <BackLink to="/student/grades" label="Mis notas" />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !item ? (
          <LoadingState rows={3} />
        ) : (
          <SubjectDetail item={item} />
        )}
      </PageBody>
    </>
  );
}

function SubjectDetail({ item }: { item: StudentSubjectGrades }) {
  const { subject, projection } = item;
  const final = projection.final_grade;
  const pending = projection.pending_terms;

  return (
    <>
      <div className="lg:hidden">
        <h2 className="font-bold text-xl">{subject.name}</h2>
        <p className="text-base-content/70 text-sm">
          {subject.code}
          {item.teachers.length > 0 && ` · Prof. ${item.teachers.join(", ")}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {item.grades.map((g) => (
          <div key={g.term} className="card card-border bg-base-100">
            <div className="card-body items-center gap-1 p-4 text-center">
              <p className="text-base-content/70 text-sm">Lapso {g.term}</p>
              <p
                className={`font-bold text-3xl tabular-nums lg:text-4xl ${
                  g.value == null
                    ? "text-base-content/30"
                    : g.value < PASSING_GRADE
                      ? "text-error"
                      : ""
                }`}
              >
                {formatGrade(g.value)}
              </p>
              <p className="text-base-content/60 text-xs">
                {g.value == null ? "Pendiente" : "Cargada"}
              </p>
            </div>
          </div>
        ))}
        <div className="card bg-neutral text-neutral-content">
          <div className="card-body items-center gap-1 p-4 text-center">
            <p className="text-neutral-content/70 text-sm">
              {final != null ? "Definitiva" : "Promedio actual"}
            </p>
            <p className="font-bold text-3xl tabular-nums lg:text-4xl">
              {formatGrade(final ?? item.average)}
            </p>
            <p className="text-neutral-content/70 text-xs">
              {final != null
                ? "Materia cerrada"
                : pending.length === 1
                  ? `Falta el lapso ${pending[0]}`
                  : `Faltan ${termsText(pending)}`}
            </p>
          </div>
        </div>
      </div>

      <section className="card card-border bg-base-100">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title">¿Qué necesito para aprobar?</h2>
            <StandingBadge projection={projection} />
          </div>
          {projection.standing === "in_progress" && projection.needed_average != null ? (
            <>
              <p className="text-base-content/70">
                {pending.length === 1 ? "Necesitas al menos" : "Necesitas un promedio de al menos"}
              </p>
              <p className="font-bold text-2xl text-primary lg:text-3xl">
                {formatGrade(projection.needed_average)} en {termsText(pending)}
              </p>
            </>
          ) : (
            <p className="text-lg">{standingSentence(projection)}</p>
          )}
        </div>
      </section>

      <section className="card bg-primary/10">
        <div className="card-body flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="font-bold text-lg">¿Dudas sobre esta materia?</h2>
            <p className="text-base-content/70 text-sm">
              Pregúntale al asistente, por ejemplo: «¿cuánto necesito para aprobar {subject.name}?»
            </p>
          </div>
          <Link
            to="/student/assistant"
            search={{ q: `¿Cuánto necesito para aprobar ${subject.name}?` }}
            className="btn btn-primary"
          >
            Abrir asistente
          </Link>
        </div>
      </section>
    </>
  );
}
