import type { Standing, StudentSubjectGrades, SubjectProjection } from "@/api/queries/student";
import { formatGrade } from "@/components/ui/grade-badge";

/** "Lapso 3", "los lapsos 2 y 3", "los lapsos 1, 2 y 3" */
export function termsText(terms: number[]): string {
  if (terms.length === 1) return `el Lapso ${terms[0]}`;
  return `los lapsos ${terms.slice(0, -1).join(", ")} y ${terms.at(-1)}`;
}

const BADGE_CLASS: Record<Standing, string> = {
  passed: "badge-success",
  secured: "badge-success",
  in_progress: "badge-info",
  failed: "badge-error",
  impossible: "badge-error",
};

/** Texto corto del estado (lo calcula la API; aquí solo se presenta) */
export function standingLabel(projection: SubjectProjection): string {
  switch (projection.standing) {
    case "passed":
      return "Aprobada";
    case "secured":
      return "Aprobada asegurada";
    case "failed":
      return "Reprobada";
    case "impossible":
      return "Ya no es posible aprobar";
    case "in_progress":
      return projection.needed_average != null
        ? `Necesitas ${formatGrade(projection.needed_average)}`
        : "En curso";
  }
}

/** Frase que explica la situación de la materia */
export function standingSentence(projection: SubjectProjection): string {
  const pending = projection.pending_terms;
  switch (projection.standing) {
    case "passed":
    case "failed":
      return `Nota definitiva: ${formatGrade(projection.final_grade)}.`;
    case "secured":
      return `Ya aprobaste aunque saques 1 en ${termsText(pending)}.`;
    case "impossible":
      return "Aunque saques 20 en lo que falta no llegarías a 10.";
    case "in_progress":
      return pending.length === 1
        ? `Necesitas al menos ${formatGrade(projection.needed_average)} en ${termsText(pending)} para aprobar.`
        : `Necesitas un promedio de al menos ${formatGrade(projection.needed_average)} en ${termsText(pending)} para aprobar.`;
  }
}

export function StandingBadge({ projection }: { projection: SubjectProjection }) {
  return (
    <span
      className={`badge badge-soft badge-sm shrink-0 font-semibold ${BADGE_CLASS[projection.standing]}`}
    >
      {standingLabel(projection)}
    </span>
  );
}

/** Situación agrupada para el resumen: aprobadas, en curso y en riesgo */
export function summaryOf(subjects: StudentSubjectGrades[]) {
  const count = (...standings: Standing[]) =>
    subjects.filter((s) => standings.includes(s.projection.standing)).length;
  return {
    approved: count("passed", "secured"),
    inProgress: count("in_progress"),
    atRisk: count("failed", "impossible"),
  };
}
