import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import * as v from "valibot";
import { PAGE_SIZE } from "@/api/queries/admin";
import { type SubjectGrades, subjectGradesQuery, TERMS } from "@/api/queries/teacher";
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
    // Lapso visible en móvil (en escritorio se ven los tres)
    term: v.optional(v.fallback(v.picklist([1, 2, 3]), 1), 1),
    offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
  }),
  search: { middlewares: [stripSearchParams({ q: "", show: "all", term: 1, offset: 0 })] },
  staticData: { title: "Planilla de notas", description: "3 lapsos · se aprueba con 10" },
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
        description={`Semestre ${subject.semester.name} · ${students.length} estudiantes`}
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
                  <div role="tablist" className="grid grid-cols-3 gap-2">
                    {TERMS.map((term) => (
                      <button
                        key={term}
                        type="button"
                        role="tab"
                        aria-selected={search.term === term}
                        className={`btn btn-sm rounded-full ${search.term === term ? "btn-primary" : "btn-outline btn-primary"}`}
                        onClick={() =>
                          navigate({ search: (prev) => ({ ...prev, term }), replace: true })
                        }
                      >
                        Lapso {term}
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
                          label={`${row.student.full_name} · Lapso ${search.term}`}
                          value={drafts.text(row, search.term)}
                          edited={drafts.isEdited(row, search.term)}
                          invalid={drafts.isInvalid(row, search.term)}
                          onChange={(value) => drafts.set(row, search.term, value)}
                          disabled={save.isPending}
                        />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Escritorio: los tres lapsos y la definitiva */}
                <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
                  <table className="table-zebra table">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        {TERMS.map((term) => (
                          <th key={term} className="w-32">
                            Lapso {term}
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
                          {TERMS.map((term) => (
                            <td key={term}>
                              <GradeCell
                                label={`${row.student.full_name} · Lapso ${term}`}
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
                  Los 3 lapsos pesan igual · Definitiva = promedio · Se aprueba con 10 · Deja una
                  celda vacía para borrar la nota.
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
