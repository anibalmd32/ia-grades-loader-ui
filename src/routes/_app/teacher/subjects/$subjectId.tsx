import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import * as v from "valibot";
import { PAGE_SIZE } from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { type SubjectGrades, subjectGradesQuery } from "@/api/queries/teacher";
import { BackLink } from "@/components/admin/common";
import {
  FinalGrade,
  GradebookStats,
  GradeCell,
  InvalidCellAlert,
  type Standing,
  standingOf,
  useGradeDrafts,
  useSaveGrades,
  useUnsavedChangesGuard,
} from "@/components/teacher/gradebook";
import { Pagination } from "@/components/ui/data-table";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { isTerm, scaleText, termName, termNumbers } from "@/lib/grades";

const SHOW_OPTIONS: { value: "all" | Standing; label: string }[] = [
  { value: "all", label: "Mostrar: Todos" },
  { value: "in_progress", label: "Mostrar: En curso" },
  { value: "passed", label: "Mostrar: Aprobados" },
  { value: "failed", label: "Mostrar: Reprobados" },
];

export const Route = createFileRoute("/_app/teacher/subjects/$subjectId")({
  params: {
    parse: ({ subjectId }) => ({
      subjectId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), subjectId),
    }),
    stringify: ({ subjectId }) => ({ subjectId: String(subjectId) }),
  },
  validateSearch: v.object({
    q: v.optional(v.fallback(v.string(), ""), ""),
    show: v.optional(
      v.fallback(v.picklist(["all", "passed", "failed", "in_progress"]), "all"),
      "all",
    ),
    // Lapso visible en móvil (en escritorio se ven todos). El máximo depende de la
    // configuración académica: uno fuera de rango se trata como el primero
    term: v.optional(
      v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)), 1),
      1,
    ),
    offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
  }),
  search: { middlewares: [stripSearchParams({ q: "", show: "all", term: 1, offset: 0 })] },
  staticData: {
    title: "Planilla de notas",
    description: (s) =>
      `${s.terms_count} ${(s.terms_count === 1 ? s.term_label : s.term_label_plural).toLowerCase()} · se aprueba con ${scaleText(s.passing_grade)}`,
  },
  component: GradebookPage,
});

function GradebookPage() {
  const { subjectId } = Route.useParams();
  const query = useQuery(subjectGradesQuery(subjectId));

  if (query.error) {
    return (
      <>
        <PageHeader title="Planilla de notas" />
        <PageBody>
          <BackLink to="/teacher/subjects" label="Mis materias" />
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </PageBody>
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title="Planilla de notas" />
        <PageBody>
          <LoadingState rows={6} />
        </PageBody>
      </>
    );
  }
  return <Gradebook data={query.data} />;
}

function Gradebook({ data }: { data: SubjectGrades }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const settings = useAcademicSettings();
  const terms = termNumbers(settings);
  const currentTerm = isTerm(search.term, settings) ? search.term : 1;
  const { subject, students } = data;
  const drafts = useGradeDrafts(data);
  const save = useSaveGrades(subject.id, drafts);
  useUnsavedChangesGuard(drafts.pending);

  const filter = search.q.trim().toLowerCase();
  const filtered = students.filter(
    (s) =>
      (search.show === "all" || standingOf(s) === search.show) &&
      (!filter ||
        s.student.full_name.toLowerCase().includes(filter) ||
        (s.student.cedula_display ?? "").toLowerCase().includes(filter)),
  );
  const offset = search.offset < filtered.length ? search.offset : 0;
  const rows = filtered.slice(offset, offset + PAGE_SIZE);

  const canSave = drafts.changes.length > 0 && drafts.invalid.length === 0 && !save.isPending;
  const actions = (
    <>
      <Link
        to="/teacher/imports"
        search={{ subject: subject.id }}
        className="btn btn-outline btn-primary"
      >
        Importar Excel
      </Link>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canSave}
        onClick={() => save.mutate(drafts.changes)}
      >
        {save.isPending && <span className="loading loading-spinner loading-sm" />}
        Guardar cambios{drafts.pending > 0 ? ` (${drafts.pending})` : ""}
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title={`${subject.code} · ${subject.name}`}
        description={`${settings.period_label} ${subject.semester.name} · ${students.length} estudiantes`}
        actions={actions}
      />
      <PageBody>
        <BackLink to="/teacher/subjects" label="Mis materias" />
        <h2 className="font-bold text-xl lg:hidden">
          {subject.code} · {subject.name}
        </h2>

        {students.length === 0 ? (
          <EmptyState
            title="Aún no hay estudiantes matriculados"
            description="Cuando la coordinación matricule estudiantes en la materia, aparecerán aquí."
          />
        ) : (
          <>
            <GradebookStats students={students} />
            <InvalidCellAlert invalid={drafts.invalid} />

            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchInput
                value={search.q}
                placeholder="Buscar estudiante"
                onChange={(q) =>
                  navigate({ search: (prev) => ({ ...prev, q, offset: 0 }), replace: true })
                }
              />
              <select
                className="select w-full sm:max-w-56"
                aria-label="Filtrar estudiantes"
                value={search.show}
                onChange={(event) =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      show: event.target.value as typeof search.show,
                      offset: 0,
                    }),
                    replace: true,
                  })
                }
              >
                {SHOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {rows.length === 0 ? (
              <EmptyState title="Ningún estudiante coincide con el filtro" />
            ) : (
              <>
                {/* Móvil: un lapso a la vez, una tarjeta por estudiante */}
                <div className="flex flex-col gap-3 lg:hidden">
                  <div
                    role="tablist"
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(terms.length, 3)}, minmax(0, 1fr))`,
                    }}
                  >
                    {terms.map((term) => (
                      <button
                        key={term}
                        type="button"
                        role="tab"
                        aria-selected={currentTerm === term}
                        className={`btn btn-sm rounded-full ${currentTerm === term ? "btn-primary" : "btn-outline btn-primary"}`}
                        onClick={() =>
                          navigate({ search: (prev) => ({ ...prev, term }), replace: true })
                        }
                      >
                        {termName(settings, term)}
                      </button>
                    ))}
                  </div>
                  <ul className="card card-border divide-y divide-base-300 bg-base-100">
                    {rows.map((row) => (
                      <li key={row.student.id} className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{row.student.full_name}</p>
                          <p className="text-base-content/70 text-xs">
                            {row.student.cedula_display}
                          </p>
                        </div>
                        <GradeCell
                          className="input-md w-24"
                          label={`${row.student.full_name} · ${termName(settings, currentTerm)}`}
                          value={drafts.text(row, currentTerm)}
                          edited={drafts.isEdited(row, currentTerm)}
                          invalid={drafts.isInvalid(row, currentTerm)}
                          onChange={(value) => drafts.set(row, currentTerm, value)}
                          disabled={save.isPending}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Escritorio: todos los lapsos configurados y la definitiva */}
                <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
                  <table className="table-zebra table">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        {terms.map((term) => (
                          <th key={term} className="w-32">
                            {termName(settings, term)}
                          </th>
                        ))}
                        <th className="w-32">Definitiva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.student.id}>
                          <td>
                            {row.student.full_name}
                            {row.student.cedula_display && (
                              <span className="text-base-content/70">
                                {" "}
                                · {row.student.cedula_display}
                              </span>
                            )}
                          </td>
                          {terms.map((term) => (
                            <td key={term}>
                              <GradeCell
                                label={`${row.student.full_name} · ${termName(settings, term)}`}
                                value={drafts.text(row, term)}
                                edited={drafts.isEdited(row, term)}
                                invalid={drafts.isInvalid(row, term)}
                                onChange={(value) => drafts.set(row, term, value)}
                                disabled={save.isPending}
                              />
                            </td>
                          ))}
                          <td>
                            <FinalGrade row={row} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-base-content/70 text-xs">
                  {settings.summary}. Deja una celda vacía para borrar la nota.
                </p>

                {filtered.length > PAGE_SIZE && (
                  <Pagination
                    page={{ total: filtered.length, limit: PAGE_SIZE, offset }}
                    onPageChange={(next) =>
                      navigate({ search: (prev) => ({ ...prev, offset: next }), replace: true })
                    }
                  />
                )}
              </>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
