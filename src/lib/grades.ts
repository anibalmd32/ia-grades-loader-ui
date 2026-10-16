// Reglas de las notas: del 1 al 20 con hasta 2 decimales (igual que la API)
export const MIN_GRADE = 1;
export const MAX_GRADE = 20;

export const GRADE_RULE = "la nota debe estar entre 1 y 20, con hasta 2 decimales";

export type ParsedGrade = { valid: true; value: number | null } | { valid: false };

/**
 * Convierte lo que escribe el profesor en una nota. Acepta coma o punto decimal;
 * vacío = sin nota (borra la que hubiera).
 */
export function parseGrade(text: string): ParsedGrade {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return { valid: true, value: null };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(clean)) return { valid: false };
  const value = Number(clean);
  if (value < MIN_GRADE || value > MAX_GRADE) return { valid: false };
  return { valid: true, value };
}

/** Texto inicial de una celda: 15.5 → "15.50"; null → "" */
export function gradeText(value: number | null | undefined): string {
  return value == null ? "" : value.toFixed(2);
}
