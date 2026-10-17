import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  finalGrade,
  type GradeEntry,
  gradeOf,
  type StudentGrades,
  type SubjectGrades,
  saveGrades,
  TERMS,
  type Term,
  teacherKeys,
} from "@/api/queries/teacher";
import { confirm } from "@/components/ui/confirm";
import { formatGrade, PASSING_GRADE } from "@/components/ui/grade-badge";
import { toast } from "@/components/ui/toast";
import { GRADE_RULE, gradeText, parseGrade } from "@/lib/grades";

const cellKey = (studentId: number, term: Term) => `${studentId}:${term}`;

export type Standing = "passed" | "failed" | "in_progress";

/** Situación del estudiante según la definitiva que devuelve la API */
export function standingOf(row: StudentGrades): Standing {
  const final = finalGrade(row);
  if (final == null) return "in_progress";
  return final >= PASSING_GRADE ? "passed" : "failed";
}

type InvalidCell = { student: StudentGrades; term: Term };

/**
 * Celdas editadas de la planilla. Solo guarda lo que el profesor escribió; el resto se lee
 * del servidor. Expone los cambios válidos (para el PUT) y las celdas inválidas.
 */
export function useGradeDrafts(data: SubjectGrades) {
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());

  const text = (row: StudentGrades, term: Term) =>
    drafts.get(cellKey(row.student.id, term)) ?? gradeText(gradeOf(row, term));

  const changes: GradeEntry[] = [];
  const invalid: InvalidCell[] = [];
  const edited = new Set<string>();
  for (const row of data.students) {
    for (const term of TERMS) {
      const key = cellKey(row.student.id, term);
      const draft = drafts.get(key);
      if (draft === undefined) continue;
      const parsed = parseGrade(draft);
      if (!parsed.valid) {
        invalid.push({ student: row, term });
        edited.add(key);
      } else if (parsed.value !== gradeOf(row, term)) {
        changes.push({ student_id: row.student.id, term, value: parsed.value });
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
    reset: () => setDrafts(new Map()),
  };
}

export type GradeDrafts = ReturnType<typeof useGradeDrafts>;

/** Guarda en lote los cambios válidos; tras guardar la planilla se refresca con la respuesta */
export function useSaveGrades(subjectId: number, drafts: GradeDrafts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: GradeEntry[]) => saveGrades(subjectId, changes),
    onSuccess: (data, changes) => {
      queryClient.setQueryData(teacherKeys.grades(subjectId), data);
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
export function InvalidCellAlert({ invalid }: { invalid: InvalidCell[] }) {
  const first = invalid[0];
  if (!first) return null;
  const more = invalid.length - 1;
  return (
    <div role="alert" className="alert alert-error alert-soft">
      <CircleAlert className="size-5 shrink-0" />
      <span>
        {first.student.student.full_name} · Lapso {first.term}: {GRADE_RULE}.
        {more > 0 && ` Hay ${more} ${more === 1 ? "celda más" : "celdas más"} por corregir.`}
      </span>
    </div>
  );
}

/** Celda editable de una nota: acepta coma o punto; vacía = sin nota */
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
  const state = invalid
    ? "input-error bg-error/10 text-error"
    : edited
      ? "input-primary bg-primary/10 font-bold"
      : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="—"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={`input input-sm w-full text-center tabular-nums ${state} ${className}`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Definitiva (de la API) o "En curso" si faltan lapsos; en rojo si reprueba */
export function FinalGrade({ row }: { row: StudentGrades }) {
  const final = finalGrade(row);
  if (final == null) return <span className="font-semibold text-base-content/60">En curso</span>;
  return (
    <span
      className={`font-bold tabular-nums ${final >= PASSING_GRADE ? "text-success" : "text-error"}`}
    >
      {formatGrade(final)}
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
