import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";
import {
  type GradeEntry,
  type ImportJobRead,
  type ImportRow,
  saveGrades,
  TERMS,
  type Term,
  teacherKeys,
} from "@/api/queries/teacher";
import { BackLink } from "@/components/admin/common";
import { confirm } from "@/components/ui/confirm";
import { formatGrade } from "@/components/ui/grade-badge";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { GRADE_RULE, gradeText, parseGrade } from "@/lib/grades";
import { useImportReviews } from "@/stores/import-reviews";
import { GradeCell } from "./gradebook";

type Preview = NonNullable<ImportJobRead["result"]>;
type RowStatus = ImportRow["status"];

/** Lo que el profesor decide de cada fila: si se guarda y con qué lapso y nota */
type Decision = { include: boolean; term: Term | null; value: string };

const STATUS_LABEL: Record<RowStatus, string> = { ok: "Lista", warning: "Aviso", error: "Error" };
const STATUS_CLASS: Record<RowStatus, string> = {
  ok: "text-success",
  warning: "text-warning",
  error: "text-error",
};

const asTerm = (term: number | null): Term | null =>
  term === 1 || term === 2 || term === 3 ? term : null;

/** "Fila 4 · "Valentina Rios 84112345"" */
function excelText(row: ImportRow): string {
  const raw = [row.raw_name, row.raw_cedula].filter(Boolean).join(" ");
  const where = row.row != null ? `Fila ${row.row}` : (row.sheet ?? "Archivo");
  return raw ? `${where} · "${raw}"` : where;
}

/** Solo se puede guardar si el servidor identificó al estudiante */
const canSave = (row: ImportRow) => row.student != null;

function initialDecision(row: ImportRow): Decision {
  const term = asTerm(row.term);
  return {
    include: canSave(row) && row.status !== "error" && term != null && row.value != null,
    term,
    value: gradeText(row.value),
  };
}

/** Comprueba una fila incluida: lapso elegido y nota válida (no vacía) */
function entryOf(row: ImportRow, decision: Decision): GradeEntry | string {
  if (!row.student) return "estudiante no identificado";
  if (decision.term == null) return "falta el lapso";
  const parsed = parseGrade(decision.value);
  if (!parsed.valid || parsed.value == null) return GRADE_RULE;
  return { student_id: row.student.id, term: decision.term, value: parsed.value };
}

/** Previsualización de una importación: revisar, corregir, excluir y confirmar */
export function ImportReview({ job, preview }: { job: ImportJobRead; preview: Preview }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markReviewed = useImportReviews((s) => s.markReviewed);
  const [decisions, setDecisions] = useState(() => preview.rows.map(initialDecision));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | RowStatus>("all");

  const update = (index: number, change: Partial<Decision>) =>
    setDecisions((prev) => prev.map((d, i) => (i === index ? { ...d, ...change } : d)));

  // Filas incluidas: las válidas se envían; las demás bloquean la confirmación
  const entries: GradeEntry[] = [];
  const problems: string[] = [];
  const seen = new Map<string, ImportRow>();
  preview.rows.forEach((row, i) => {
    const decision = decisions[i];
    if (!decision?.include) return;
    const entry = entryOf(row, decision);
    if (typeof entry === "string") {
      problems.push(`${excelText(row)}: ${entry}.`);
      return;
    }
    const key = `${entry.student_id}:${entry.term}`;
    const other = seen.get(key);
    if (other) {
      problems.push(
        `${row.student?.full_name} tiene dos notas para el lapso ${entry.term} (${excelText(other)} y ${excelText(row)}). Excluye una.`,
      );
      return;
    }
    seen.set(key, row);
    entries.push(entry);
  });

  const confirmImport = useMutation({
    mutationFn: () => saveGrades(preview.subject.id, entries),
    onSuccess: async (data) => {
      queryClient.setQueryData(teacherKeys.grades(preview.subject.id), data);
      markReviewed(job.id, "confirmed");
      toast.success(
        entries.length === 1 ? "1 nota guardada." : `${entries.length} notas guardadas.`,
      );
      await navigate({
        to: "/teacher/subjects/$subjectId",
        params: { subjectId: preview.subject.id },
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const discard = async () => {
    const ok = await confirm({
      title: "¿Descartar la importación?",
      message: "No se guardará ninguna nota de este archivo.",
      confirmLabel: "Descartar",
      danger: true,
    });
    if (!ok) return;
    markReviewed(job.id, "discarded");
    await navigate({ to: "/teacher/imports" });
  };

  const filter = q.trim().toLowerCase();
  const visible = preview.rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        (status === "all" || row.status === status) &&
        (!filter ||
          excelText(row).toLowerCase().includes(filter) ||
          (row.student?.full_name ?? "").toLowerCase().includes(filter) ||
          (row.student?.cedula_display ?? "").toLowerCase().includes(filter)),
    );

  const { subject, summary } = preview;
  const actions = (
    <>
      <button type="button" className="btn btn-outline btn-primary" onClick={discard}>
        Descartar
      </button>
      <button
        type="button"
        className="btn btn-primary"
        disabled={entries.length === 0 || problems.length > 0 || confirmImport.isPending}
        onClick={() => confirmImport.mutate()}
      >
        {confirmImport.isPending && <span className="loading loading-spinner loading-sm" />}
        Confirmar y guardar {entries.length} {entries.length === 1 ? "nota" : "notas"}
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title="Revisa la importación"
        description={`${job.file_name} · ${subject.code} ${subject.name} · ${preview.rows.length} filas leídas`}
        actions={actions}
      />
      <PageBody>
        <BackLink to="/teacher/imports" label="Importaciones" />
        <p className="text-base-content/70 text-sm lg:hidden">
          {job.file_name} · {subject.code} · {preview.rows.length} filas leídas
        </p>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["ok", summary.ok, "Listas"],
              ["warning", summary.warning, "Con aviso"],
              ["error", summary.error, "Con error"],
            ] as const
          ).map(([key, value, label]) => (
            <div key={key} className="card card-border bg-base-100">
              <div className="card-body gap-0 p-4">
                <p className={`font-bold text-2xl tabular-nums lg:text-3xl ${STATUS_CLASS[key]}`}>
                  {value}
                </p>
                <p className="text-base-content/70 text-sm">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {(summary.warning > 0 || summary.error > 0) && (
          <div role="note" className="alert alert-warning alert-soft">
            <TriangleAlert className="size-5 shrink-0" />
            <span>
              Revisa las filas con aviso. Las filas con error no se guardarán salvo que las
              corrijas; también puedes cargarlas luego a mano.
            </span>
          </div>
        )}
        {preview.warnings.map((warning) => (
          <div key={warning} role="note" className="alert alert-soft">
            <TriangleAlert className="size-5 shrink-0" />
            <span>{warning}</span>
          </div>
        ))}
        {problems.length > 0 && (
          <div role="alert" className="alert alert-error alert-soft">
            <CircleAlert className="size-5 shrink-0" />
            <ul className="flex flex-col gap-1">
              {problems.slice(0, 5).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
              {problems.length > 5 && <li>Y {problems.length - 5} filas más por corregir.</li>}
            </ul>
          </div>
        )}
        {preview.students_without_grades.length > 0 && (
          <details className="collapse-arrow collapse border border-base-300 bg-base-100">
            <summary className="collapse-title flex items-center gap-2 font-semibold text-sm">
              <Users className="size-4" />
              {preview.students_without_grades.length} matriculados no aparecen en el archivo
            </summary>
            <div className="collapse-content text-sm">
              <ul className="flex flex-col gap-1">
                {preview.students_without_grades.map((s) => (
                  <li key={s.id}>
                    {s.full_name}
                    {s.cedula_display && (
                      <span className="text-base-content/60"> · {s.cedula_display}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar en la previsualización" />
          <select
            className="select w-full sm:max-w-56"
            aria-label="Filtrar por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="all">Estado: Todos</option>
            <option value="ok">Estado: Listas</option>
            <option value="warning">Estado: Con aviso</option>
            <option value="error">Estado: Con error</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="Ninguna fila coincide con el filtro" />
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map(({ row, index }) => (
              <PreviewRow
                key={index}
                row={row}
                decision={decisions[index] as Decision}
                onChange={(change) => update(index, change)}
              />
            ))}
          </ul>
        )}

        <p className="text-base-content/70 text-xs">
          La IA solo extrae cédula/nombre, lapso y nota; el sistema identifica al estudiante entre
          los matriculados.
        </p>
      </PageBody>
    </>
  );
}

/** Una fila del Excel: dato leído, estudiante, lapso, nota editable y estado */
function PreviewRow({
  row,
  decision,
  onChange,
}: {
  row: ImportRow;
  decision: Decision;
  onChange: (change: Partial<Decision>) => void;
}) {
  const editable = canSave(row);
  const parsed = parseGrade(decision.value);
  const invalid = decision.include && (!parsed.valid || parsed.value == null);
  const label = row.student?.full_name ?? excelText(row);
  const issues = row.issues.length > 0 ? row.issues.join(" · ") : STATUS_LABEL[row.status];

  return (
    <li
      className={`card card-border bg-base-100 ${decision.include ? "" : "opacity-60"}`}
      data-status={row.status}
    >
      <div className="card-body grid gap-3 p-4 lg:grid-cols-[auto_1.2fr_1.2fr_7rem_6rem_1.4fr] lg:items-center">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={decision.include}
            disabled={!editable}
            aria-label={`Guardar ${label}`}
            onChange={(event) => onChange({ include: event.target.checked })}
          />
          <span className="text-sm lg:hidden">Guardar esta nota</span>
        </label>
        <p className="text-base-content/80 text-sm">{excelText(row)}</p>
        <p className={`font-semibold ${row.student ? "" : "text-error"}`}>
          {row.student
            ? `${row.student.full_name}${row.student.cedula_display ? ` · ${row.student.cedula_display}` : ""}`
            : "No identificado"}
        </p>
        <select
          className="select select-sm w-full"
          aria-label={`Lapso de ${label}`}
          disabled={!editable}
          value={decision.term ?? ""}
          onChange={(event) =>
            onChange({ term: event.target.value ? asTerm(Number(event.target.value)) : null })
          }
        >
          <option value="">Lapso…</option>
          {TERMS.map((t) => (
            <option key={t} value={t}>
              Lapso {t}
            </option>
          ))}
        </select>
        <GradeCell
          label={`Nota de ${label}`}
          value={decision.value}
          edited={decision.value !== gradeText(row.value)}
          invalid={invalid}
          disabled={!editable}
          onChange={(value) => onChange({ value, include: true })}
        />
        <p className={`font-semibold text-sm ${STATUS_CLASS[row.status]}`}>
          {issues}
          {row.current_value != null && (
            <span className="block font-normal text-base-content/60 text-xs">
              Nota actual: {formatGrade(row.current_value)} (se sobrescribirá)
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
