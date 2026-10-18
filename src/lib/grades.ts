import type { AcademicSettings } from "@/api/queries/settings";

// Las reglas de las notas (escala, decimales, lapsos) las configura el super admin y llegan de
// GET /settings/academic. Aquí solo se validan y se presentan; los cálculos los hace la API.

type GradeScale = Pick<AcademicSettings, "min_grade" | "max_grade" | "grade_decimals">;
type GradeDecimals = Pick<AcademicSettings, "grade_decimals">;
type TermSettings = Pick<AcademicSettings, "term_label" | "term_label_plural">;

export type ParsedGrade = { valid: true; value: number | null } | { valid: false };

/** Número de la escala sin ceros de relleno: 20 → "20"; 9.5 → "9.5" */
export function scaleText(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** "con hasta 2 decimales", "con hasta 1 decimal" o "sin decimales" */
export function decimalsText(decimals: number): string {
  if (decimals <= 0) return "sin decimales";
  return `con hasta ${decimals} ${decimals === 1 ? "decimal" : "decimales"}`;
}

/** Regla de una nota válida, p. ej. "la nota debe estar entre 1 y 20, con hasta 2 decimales" */
export function gradeRule(settings: GradeScale): string {
  return `la nota debe estar entre ${scaleText(settings.min_grade)} y ${scaleText(settings.max_grade)}, ${decimalsText(settings.grade_decimals)}`;
}

/**
 * Convierte lo que escribe el profesor en una nota según la escala configurada. Acepta coma o
 * punto decimal; vacío = sin nota (borra la que hubiera).
 */
export function parseGrade(text: string, settings: GradeScale): ParsedGrade {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return { valid: true, value: null };
  const decimals = Math.max(0, settings.grade_decimals);
  const pattern = decimals === 0 ? /^\d{1,3}$/ : new RegExp(`^\\d{1,3}(\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(clean)) return { valid: false };
  const value = Number(clean);
  if (value < settings.min_grade || value > settings.max_grade) return { valid: false };
  return { valid: true, value };
}

/** Texto inicial de una celda editable: 15.5 → "15.50" (con 2 decimales); null → "" */
export function gradeText(value: number | null | undefined, settings: GradeDecimals): string {
  return value == null ? "" : value.toFixed(settings.grade_decimals);
}

/** Nota para mostrar: 15.5 → "15.50" (2 decimales por defecto); null → "—" */
export function formatGrade(value: number | null | undefined, settings?: GradeDecimals): string {
  return value == null ? "—" : value.toFixed(settings?.grade_decimals ?? 2);
}

/** ¿La nota llega a la aprobatoria? (para colorear; la definitiva la decide la API) */
export function isPassing(value: number, settings: Pick<AcademicSettings, "passing_grade">) {
  return value >= settings.passing_grade;
}

/** Números de lapso configurados: [1, 2, 3] */
export function termNumbers(settings: Pick<AcademicSettings, "terms_count">): number[] {
  return Array.from({ length: settings.terms_count }, (_, i) => i + 1);
}

/** ¿Es un número de lapso válido con la configuración actual? */
export function isTerm(
  term: number | null | undefined,
  settings: Pick<AcademicSettings, "terms_count">,
): term is number {
  return term != null && Number.isInteger(term) && term >= 1 && term <= settings.terms_count;
}

/** "Lapso 1" */
export function termName(settings: Pick<AcademicSettings, "term_label">, term: number): string {
  return `${settings.term_label} ${term}`;
}

/** "Lapso 3", "Lapsos 2 y 3", "Lapsos 1, 2 y 3" (sin artículo: la etiqueta puede ser femenina) */
export function termsText(settings: TermSettings, terms: number[]): string {
  if (terms.length === 1) return termName(settings, terms[0] as number);
  return `${settings.term_label_plural} ${terms.slice(0, -1).join(", ")} y ${terms.at(-1)}`;
}
