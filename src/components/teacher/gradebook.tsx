import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { gradeHistoryKeys } from "@/api/queries/grade-history";
import { type AcademicSettings, useSubjectRules } from "@/api/queries/settings";
import {
  type GradeEntry,
  gradeOf,
  isAbsent,
  type StudentGrades,
  type SubjectGrades,
  saveGrades,
  type Term,
  teacherKeys,
} from "@/api/queries/teacher";
import { confirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import {
  ABSENT_LABEL,
  ABSENT_SHORT,
  formatGrade,
  gradeRule,
  gradeText,
  parseGrade,
  termName,
  termNumbers,
} from "@/lib/grades";

const cellKey = (studentId: number, term: Term) => `${studentId}:${term}`;

type GradeScale = Pick<AcademicSettings, "min_grade" | "max_grade" | "grade_decimals">;

export type ParsedCell =
  | { valid: true; value: number | null; absent: boolean }
  | { valid: false; absent: false };

/** ¿El texto de la celda marca inasistencia? ("I", sin distinguir mayúsculas) */
export const isAbsentText = (text: string) => text.trim().toUpperCase() === ABSENT_SHORT;

/**
 * Lo que escribe el profesor en una celda: "I" = inasistente (cuenta con la nota mínima, la
 * pone la API); vacío = sin nota; si no, una nota de la escala.
 */
export function parseCell(text: string, settings: GradeScale): ParsedCell {
  if (isAbsentText(text)) return { valid: true, value: null, absent: true };
  const parsed = parseGrade(text, settings);
  return parsed.valid ? { ...parsed, absent: false } : { valid: false, absent: false };
}

/** Texto de una celda guardada: "I" si es inasistente, si no la nota */
export function cellText(
  value: number | null | undefined,
  absent: boolean,
  settings: Pick<AcademicSettings, "grade_decimals">,
): string {
  return absent ? ABSENT_SHORT : gradeText(value, settings);
}

export type Standing = "passed" | "failed" | "in_progress";

/** Situación del estudiante según la definitiva y el aprobado que devuelve la API */
export function standingOf(row: StudentGrades): Standing {
  if (row.final_grade == null || row.passed == null) return "in_progress";
  return row.passed ? "passed" : "failed";
}

type InvalidCell = { student: StudentGrades; term: Term };

/**
 * Celdas editadas de la planilla. Solo guarda lo que el profesor escribió; el resto se lee
 * del servidor. Expone los cambios válidos (para el PUT) y las celdas inválidas, según las
 * reglas del periodo de la materia (las congeladas si se cerró alguna vez). "I" marca al
 * estudiante como inasistente en el lapso.
 */
export function useGradeDrafts(data: SubjectGrades) {
  const settings = useSubjectRules(data.subject.semester);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());

  const saved = (row: StudentGrades, term: Term) =>
    cellText(gradeOf(row, term), isAbsent(row, term), settings);
  const text = (row: StudentGrades, term: Term) =>
    drafts.get(cellKey(row.student.id, term)) ?? saved(row, term);

  const changes: GradeEntry[] = [];
  const invalid: InvalidCell[] = [];
  const edited = new Set<string>();
  for (const row of data.students) {
    for (const term of termNumbers(settings)) {
      const key = cellKey(row.student.id, term);
      const draft = drafts.get(key);
      if (draft === undefined) continue;
      const parsed = parseCell(draft, settings);
      if (!parsed.valid) {
        invalid.push({ student: row, term });
        edited.add(key);
      } else if (parsed.absent !== isAbsent(row, term)) {
        changes.push({
          student_id: row.student.id,
          term,
          value: parsed.absent ? null : parsed.value,
          absent: parsed.absent,
        });
        edited.add(key);
      } else if (!parsed.absent && parsed.value !== gradeOf(row, term)) {
        changes.push({ student_id: row.student.id, term, value: parsed.value, absent: false });
        edited.add(key);
      }
    }
  }

  return {
    text,
    changes,
    invalid,
    /** Celdas con cambios sin guardar (válidos o no) */
    pending: edited.size,
    isEdited: (row: StudentGrades, term: Term) => edited.has(cellKey(row.student.id, term)),
    isInvalid: (row: StudentGrades, term: Term) =>
      invalid.some((c) => c.student === row && c.term === term),
    set: (row: StudentGrades, term: Term, value: string) =>
      setDrafts((prev) => new Map(prev).set(cellKey(row.student.id, term), value)),
    /** Marca o desmarca la inasistencia (al desmarcar vuelve a la nota guardada o a vacía) */
    toggleAbsent: (row: StudentGrades, term: Term) => {
      const current = drafts.get(cellKey(row.student.id, term)) ?? saved(row, term);
      const next = !isAbsentText(current)
        ? ABSENT_SHORT
        : isAbsent(row, term)
          ? ""
          : gradeText(gradeOf(row, term), settings);
      setDrafts((prev) => new Map(prev).set(cellKey(row.student.id, term), next));
    },
    reset: () => setDrafts(new Map()),
  };
}

export type GradeDrafts = ReturnType<typeof useGradeDrafts>;

/** Guarda en lote los cambios válidos; tras guardar la planilla se refresca con la respuesta */
export function useSaveGrades(subjectId: number, sectionId: number, drafts: GradeDrafts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: GradeEntry[]) => saveGrades(subjectId, sectionId, changes),
    onSuccess: (data, changes) => {
      queryClient.setQueryData(teacherKeys.grades(subjectId, sectionId), data);
      void queryClient.invalidateQueries({ queryKey: gradeHistoryKeys.all });
      drafts.reset();
      toast.success(
        changes.length === 1 ? "1 nota guardada." : `${changes.length} notas guardadas.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Pide confirmación antes de salir de la planilla con cambios sin guardar */
export function useUnsavedChangesGuard(pending: number) {
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      // Cambiar de lapso, buscar, filtrar o paginar no sale de la planilla: no avisar
      if (pendingRef.current === 0 || current.pathname === next.pathname) return false;
      const leave = await confirm({
        title: "¿Salir sin guardar?",
        message: `Tienes ${pendingRef.current} ${pendingRef.current === 1 ? "cambio" : "cambios"} sin guardar en la planilla. Si sales, se perderán.`,
        confirmLabel: "Salir sin guardar",
        cancelLabel: "Seguir editando",
        danger: true,
      });
      return !leave;
    },
    enableBeforeUnload: () => pendingRef.current > 0,
  });
}

/** Aviso con la primera celda inválida (en el formato del diseño) */
export function InvalidCellAlert({
  invalid,
  settings,
}: {
  invalid: InvalidCell[];
  settings: AcademicSettings;
}) {
  const first = invalid[0];
  if (!first) return null;
  const more = invalid.length - 1;
  return (
    <div role="alert" className="alert alert-error alert-soft">
      <CircleAlert className="size-5 shrink-0" />
      <span>
        {first.student.student.full_name} · {termName(settings, first.term)}: {gradeRule(settings)}{" "}
        (o «{ABSENT_SHORT}» si es inasistente).
        {more > 0 && ` Hay ${more} ${more === 1 ? "celda más" : "celdas más"} por corregir.`}
      </span>
    </div>
  );
}

/**
 * Botón "I" junto a una celda: marca o desmarca al estudiante como inasistente (también se
 * puede escribir "I" en la celda). En un lapso con plan de evaluación lo marca inasistente en
 * todas sus evaluaciones.
 */
export function AbsentToggle({
  pressed,
  label,
  onClick,
  disabled = false,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-xs btn-square shrink-0 ${pressed ? "btn-warning" : "btn-ghost"}`}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {ABSENT_SHORT}
    </button>
  );
}

/** Celda editable de una nota: acepta coma o punto; vacía = sin nota; "I" = inasistente */
export function GradeCell({
  value,
  label,
  edited,
  invalid,
  onChange,
  className = "",
  disabled = false,
}: {
  value: string;
  label: string;
  edited: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const absent = isAbsentText(value);
  const state = invalid
    ? "input-error bg-error/10 text-error"
    : edited
      ? "input-primary bg-primary/10 font-bold"
      : absent
        ? "bg-warning/15 font-bold text-warning-content"
        : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="—"
      aria-label={label}
      title={absent ? ABSENT_LABEL : undefined}
      aria-invalid={invalid || undefined}
      className={`input input-sm text-center tabular-nums ${state} ${className || "w-full"}`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Definitiva y aprobado (de la API) o "En curso" si faltan lapsos; en rojo si reprueba */
export function FinalGrade({ row, settings }: { row: StudentGrades; settings: AcademicSettings }) {
  if (row.final_grade == null) {
    return <span className="font-semibold text-base-content/60">En curso</span>;
  }
  return (
    <span className={`font-bold tabular-nums ${row.passed ? "text-success" : "text-error"}`}>
      {formatGrade(row.final_grade, settings)}
    </span>
  );
}

/**
 * Tarjetas de resumen: aprobados, reprobados y en curso (según la definitiva de la API).
 * No hay promedio de la sección: la API no lo da y no se calculan notas en el front.
 */
export function GradebookStats({ students }: { students: StudentGrades[] }) {
  const count = (standing: Standing) => students.filter((s) => standingOf(s) === standing).length;

  const stats = [
    { label: "Aprobados", value: String(count("passed")), className: "text-success" },
    { label: "Reprobados", value: String(count("failed")), className: "text-error" },
    { label: "En curso", value: String(count("in_progress")), className: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card card-border bg-base-100">
          <div className="card-body gap-0 p-4">
            <p className={`font-bold text-2xl tabular-nums lg:text-3xl ${stat.className}`}>
              {stat.value}
            </p>
            <p className="text-base-content/70 text-sm">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
