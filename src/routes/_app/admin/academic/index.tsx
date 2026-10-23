import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import {
  MAX_LIMIT,
  type SemesterRead,
  type SubjectRead,
  semesterSectionsQuery,
  semestersQuery,
  subjectsQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { NewPeriodModal, PeriodBar } from "@/components/admin/period-bar";
import { SectionsPanel } from "@/components/admin/sections-panel";
import { ClosedPeriodNotice } from "@/components/ui/closed-period";
import { DataTable } from "@/components/ui/data-table";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ACADEMIC_LABEL } from "@/lib/roles";

const TABS = ["materias", "secciones"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_app/admin/academic/")({
  validateSearch: v.object({
    semester: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
    tab: v.optional(v.fallback(v.picklist(TABS), "materias"), "materias"),
    q: v.optional(v.fallback(v.string(), ""), ""),
    offset: v.optional(v.fallback(v.pipe(v.number(), v.integer(), v.minValue(0)), 0), 0),
  }),
  search: { middlewares: [stripSearchParams({ tab: "materias", q: "", offset: 0 })] },
  staticData: {
    title: ACADEMIC_LABEL,
    description: "Periodos, secciones y materias de la institución",
  },
  component: AcademicPage,
});

function AcademicPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const semesters = useQuery(semestersQuery);
  const [creatingPeriod, setCreatingPeriod] = useState(false);
  // Sin periodo en la URL se muestra el primero
  const semester = semesters.data?.find((s) => s.id === search.semester) ?? semesters.data?.[0];

  const selectPeriod = (id: number) =>
    navigate({ search: (prev) => ({ ...prev, semester: id, q: "", offset: 0 }) });

  let body: React.ReactNode;
  if (semesters.error) {
    body = <ErrorState error={semesters.error} onRetry={() => semesters.refetch()} />;
  } else if (!semesters.data) {
    body = <LoadingState rows={4} />;
  } else if (!semester) {
    body = (
      <EmptyState
        title={`Aún no hay ${settings.period_label_plural.toLowerCase()}`}
        description={`Crea el primer ${period} para añadir sus secciones y materias.`}
      />
    );
  } else {
    body = (
      <PeriodContent
        key={semester.id}
        semesters={semesters.data}
        semester={semester}
        tab={search.tab}
        onSelect={selectPeriod}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={ACADEMIC_LABEL}
        description="Periodos, secciones y materias de la institución"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreatingPeriod(true)}>
            <Plus className="size-4" />
            Nuevo {period}
          </button>
        }
      />
      <PageBody>{body}</PageBody>
      {creatingPeriod && (
        <NewPeriodModal onClose={() => setCreatingPeriod(false)} onCreated={selectPeriod} />
      )}
    </>
  );
}

function PeriodContent({
  semesters,
  semester,
  tab,
  onSelect,
}: {
  semesters: SemesterRead[];
  semester: SemesterRead;
  tab: Tab;
  onSelect: (id: number) => void;
}) {
  const navigate = Route.useNavigate();
  // Todas las materias del periodo: resumen y materias con profesor de cada sección
  const allSubjects = useQuery(subjectsQuery({ semester_id: semester.id, limit: MAX_LIMIT }));
  const sections = useQuery(semesterSectionsQuery(semester.id));
  const summary = {
    subjects: allSubjects.data?.total,
    sections: sections.data?.length,
    students: sections.data?.reduce((sum, s) => sum + (s.students_count ?? 0), 0),
  };

  return (
    <div className="flex flex-col gap-4">
      <PeriodBar semesters={semesters} selected={semester} summary={summary} onSelect={onSelect} />
      {semester.is_closed && (
        <ClosedPeriodNotice
          semester={semester}
          message="sus notas, matrículas, secciones y materias solo se pueden consultar. Reábrelo para hacer cambios."
        />
      )}
      <div role="tablist" className="tabs tabs-border">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`tab font-semibold ${tab === value ? "tab-active" : ""}`}
            onClick={() => navigate({ search: (prev) => ({ ...prev, tab: value }) })}
          >
            {value === "materias" ? "Materias" : "Secciones"}
          </button>
        ))}
      </div>
      {tab === "materias" ? (
        <SubjectsTab semester={semester} />
      ) : (
        <SectionsPanel semester={semester} subjects={allSubjects.data?.items} />
      )}
    </div>
  );
}

/** Materias del periodo con el profesor de cada sección (⚠ las secciones sin profesor) */
function SubjectsTab({ semester }: { semester: SemesterRead }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const settings = useAcademicSettings();
  const period = settings.period_label.toLowerCase();
  const subjects = useQuery(
    subjectsQuery({ semester_id: semester.id, q: search.q, offset: search.offset }),
  );
  const open = (s: SubjectRead) =>
    navigate({ to: "/admin/academic/subjects/$subjectId", params: { subjectId: s.id } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search.q}
          placeholder="Buscar materia"
          onChange={(q) => navigate({ search: (prev) => ({ ...prev, q, offset: 0 }) })}
        />
        {semester.is_closed ? (
          <button type="button" className="btn btn-primary" disabled>
            <Plus className="size-4" />
            Nueva materia
          </button>
        ) : (
          <Link
            to="/admin/academic/new"
            search={{ semester: semester.id }}
            className="btn btn-primary"
          >
            <Plus className="size-4" />
            Nueva materia
          </Link>
        )}
      </div>
      <DataTable
        rows={subjects.data?.items}
        isLoading={subjects.isPending}
        error={subjects.error}
        onRetry={() => subjects.refetch()}
        rowKey={(s) => s.id}
        emptyTitle={
          search.q ? "Sin resultados para la búsqueda" : `Este ${period} no tiene materias`
        }
        page={subjects.data}
        onPageChange={(offset) => navigate({ search: (prev) => ({ ...prev, offset }) })}
        onRowClick={open}
        columns={[
          {
            header: "Código",
            cell: (s) => <span className="whitespace-nowrap font-medium">{s.code}</span>,
          },
          { header: "Materia", cell: (s) => s.name },
          { header: "Profesores por sección", cell: (s) => <SectionTeachers subject={s} /> },
          { header: "Estudiantes", cell: (s) => s.students_count ?? "" },
          {
            header: "",
            cell: (s) => (
              <Link
                to="/admin/academic/subjects/$subjectId"
                params={{ subjectId: s.id }}
                className="link link-primary inline-flex items-center whitespace-nowrap font-bold no-underline"
              >
                Ver
                <ChevronRight className="size-4" />
              </Link>
            ),
          },
        ]}
        renderCard={(s) => (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate font-bold">
              {s.code} · {s.name}
            </p>
            <SectionTeachers subject={s} />
            {s.students_count != null && (
              <p className="text-base-content/70 text-sm">
                {s.students_count === 1 ? "1 estudiante" : `${s.students_count} estudiantes`}
              </p>
            )}
          </div>
        )}
      />
    </div>
  );
}

/** "A · Carmen Rojas" por línea; las secciones sin profesor, en aviso */
function SectionTeachers({ subject }: { subject: SubjectRead }) {
  const rows = subject.section_teachers;
  if (!rows) return null;
  if (rows.length === 0) {
    return <span className="text-base-content/60 text-sm">Sin secciones</span>;
  }
  return (
    <ul className="flex flex-col text-sm">
      {rows.map((row) => (
        <li key={row.section_id} className="whitespace-nowrap">
          <span className="font-semibold">{row.section_name}</span> ·{" "}
          {row.teacher_name != null ? (
            <span>{row.teacher_name}</span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-warning">
              <TriangleAlert className="size-3.5" />
              Sin profesor
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
