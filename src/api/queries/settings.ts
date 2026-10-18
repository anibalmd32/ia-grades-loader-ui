import { type QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../client";
import type { components } from "../schema";

export type AcademicSettings = components["schemas"]["AcademicSettingsRead"];
export type AcademicSettingsUpdate = components["schemas"]["AcademicSettingsUpdate"];
export type PeriodType = components["schemas"]["PeriodType"];

export const settingsKeys = {
  all: ["settings"] as const,
  academic: ["settings", "academic"] as const,
};

/**
 * Lo que la app daba por hecho antes de que la configuración fuera editable. Se usa mientras
 * llega la configuración real, para que ninguna pantalla se quede sin reglas.
 */
export const DEFAULT_ACADEMIC_SETTINGS: AcademicSettings = {
  institution_name: "Universidad",
  period_type: "semester",
  terms_count: 3,
  term_label: "Lapso",
  term_weights: null,
  min_grade: 1,
  max_grade: 20,
  passing_grade: 10,
  grade_decimals: 2,
  round_final_grade: false,
  period_label: "Semestre",
  period_label_plural: "Semestres",
  term_label_plural: "Lapsos",
  term_percentages: [33.33, 33.33, 33.33],
  summary: "La definitiva es el promedio simple de los 3 lapsos y se aprueba con 10 o más",
  document_label: "Cédula",
  document_types: [
    { code: "V", name: "Venezolano" },
    { code: "E", name: "Extranjero" },
  ],
  assistant_enabled: true,
  telegram_enabled: true,
};

/** Reglas académicas (periodos, lapsos y escala de notas). Es pública: no exige sesión */
export const academicSettingsQuery = queryOptions({
  queryKey: settingsKeys.academic,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/settings/academic", { signal })),
  // Cambia muy de vez en cuando (solo el super admin); al guardarla se refresca a mano
  staleTime: 10 * 60_000,
});

/** Configuración académica vigente; mientras carga (o si falla) devuelve la de por defecto */
export function useAcademicSettings(): AcademicSettings {
  const { data } = useQuery(academicSettingsQuery);
  return data ?? DEFAULT_ACADEMIC_SETTINGS;
}

/** Reemplaza la configuración completa (solo super admin) */
export function updateAcademicSettings(body: AcademicSettingsUpdate) {
  return unwrap(api.PUT("/api/v1/settings/academic", { body }));
}

/**
 * Tras guardar: la configuración nueva pasa a la caché y se refresca todo lo demás, porque las
 * notas, promedios, proyecciones y textos dependen de ella.
 */
export async function applyAcademicSettings(queryClient: QueryClient, saved: AcademicSettings) {
  queryClient.setQueryData(settingsKeys.academic, saved);
  await queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== settingsKeys.all[0],
  });
}

export type GradingRules = components["schemas"]["GradingRulesRead"];

/** Lo que hace falta de un periodo para saber con qué reglas se evalúa */
type SemesterWithRules = { rules?: GradingRules | null } | null | undefined;

/**
 * Reglas con que se evalúan las notas de un periodo: las congeladas al cerrarlo (que se
 * conservan aunque se reabra) sobre la configuración vigente. Sin reglas propias, el periodo
 * sigue la configuración actual. Los nombres de periodo, la institución o el documento salen
 * siempre de la configuración.
 */
export function rulesFor(
  semester: SemesterWithRules,
  settings: AcademicSettings,
): AcademicSettings {
  return semester?.rules ? { ...settings, ...semester.rules } : settings;
}

/** `rulesFor` con la configuración vigente: úsalo para mostrar o validar notas de una materia */
export function useSubjectRules(semester: SemesterWithRules): AcademicSettings {
  return rulesFor(semester, useAcademicSettings());
}
