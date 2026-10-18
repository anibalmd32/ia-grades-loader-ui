import type { AcademicSettings } from "@/api/queries/settings";
import type { Standing, StudentSubjectGrades, SubjectProjection } from "@/api/queries/student";
import { formatGrade, scaleText, termsText } from "@/lib/grades";

const BADGE_CLASS: Record<Standing, string> = {
  passed: "badge-success",
  secured: "badge-success",
  in_progress: "badge-info",
  failed: "badge-error",
  impossible: "badge-error",
};

/** Texto corto del estado (lo calcula la API; aquí solo se presenta) */
export function standingLabel(projection: SubjectProjection, settings: AcademicSettings): string {
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
        ? `Necesitas ${formatGrade(projection.needed_average, settings)}`
        : "En curso";
  }
}

/** Frase que explica la situación de la materia, con la escala y los lapsos configurados */
export function standingSentence(
  projection: SubjectProjection,
  settings: AcademicSettings,
): string {
  const pending = projection.pending_terms;
  const needed = formatGrade(projection.needed_average, settings);
  switch (projection.standing) {
    case "passed":
    case "failed":
      return `Nota definitiva: ${formatGrade(projection.final_grade, settings)}.`;
    case "secured":
      return `Ya aprobaste aunque saques ${scaleText(settings.min_grade)} en ${termsText(settings, pending)}.`;
    case "impossible":
      return `Aunque saques ${scaleText(settings.max_grade)} en ${termsText(settings, pending)} no llegarías a ${scaleText(settings.passing_grade)}.`;
    case "in_progress":
      return pending.length === 1
        ? `Necesitas al menos ${needed} en ${termsText(settings, pending)} para aprobar.`
        : `Necesitas un promedio de al menos ${needed} en ${termsText(settings, pending)} para aprobar.`;
  }
}

export function StandingBadge({
  projection,
  settings,
}: {
  projection: SubjectProjection;
  settings: AcademicSettings;
}) {
  return (
    <span
      className={`badge badge-soft badge-sm shrink-0 font-semibold ${BADGE_CLASS[projection.standing]}`}
    >
      {standingLabel(projection, settings)}
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
