import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { isApiError } from "@/api/errors";
import {
  type AcademicSettings,
  type AcademicSettingsUpdate,
  applyAcademicSettings,
  type PeriodType,
  updateAcademicSettings,
} from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { toast } from "@/components/ui/toast";
import { decimalsText, scaleText, termNumbers } from "@/lib/grades";

const PERIOD_TYPES = ["semester", "trimester", "quadrimester", "annual"] as const;

export const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "semester", label: "Semestres" },
  { value: "trimester", label: "Trimestres" },
  { value: "quadrimester", label: "Cuatrimestres" },
  { value: "annual", label: "Años" },
];

const DECIMAL_OPTIONS = [
  { value: "0", label: "0 (solo enteros)" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
];

export const MAX_TERMS = 10;
const MAX_GRADE_LIMIT = 100;

/** Número escrito por el usuario (acepta coma decimal) */
export const toNumber = (text: string) => Number(text.trim().replace(",", "."));

/** ¿El número no tiene más decimales de los admitidos? */
const fitsDecimals = (text: string, decimals: number) => {
  const value = toNumber(text);
  return Math.abs(value - Number(value.toFixed(decimals))) < 1e-9;
};

/** Pesos que suman 100 entre `count` lapsos, en texto: 3 → ["33.34", "33.33", "33.33"] */
export function evenWeights(count: number): string[] {
  const base = Math.floor(10000 / count);
  const remainder = 10000 - base * count;
  return Array.from({ length: count }, (_, i) => scaleText((base + (i < remainder ? 1 : 0)) / 100));
}

/** Suma de los porcentajes escritos (en centésimas, para no arrastrar errores de coma flotante) */
export function weightsTotal(weights: string[]): number {
  const cents = weights.reduce((sum, w) => {
    const value = toNumber(w);
    return sum + (Number.isFinite(value) ? Math.round(value * 100) : 0);
  }, 0);
  return cents / 100;
}

/** ¿Son válidos los porcentajes? Cada uno > 0 y ≤ 100, hasta 2 decimales, y suman 100 */
export function weightsAreValid(weights: string[]): boolean {
  const valid = weights.every((w) => {
    if (!/^\d{1,3}([.,]\d{1,2})?$/.test(w.trim())) return false;
    const value = toNumber(w);
    return value > 0 && value <= 100;
  });
  return valid && weightsTotal(weights) === 100;
}

/** Plural de la etiqueta del lapso (como la API): Lapso → Lapsos, Evaluación → Evaluaciones */
export function termLabelPlural(label: string): string {
  const clean = label.trim();
  if (clean.endsWith("ón")) return `${clean.slice(0, -2)}ones`;
  return clean + ("aeiouáéíóú".includes(clean.slice(-1).toLowerCase()) ? "s" : "es");
}

const gradeText = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d{1,3}([.,]\d+)?$/, "Escribe un número, p. ej. 10 o 9.5."),
  v.check((text) => toNumber(text) <= MAX_GRADE_LIMIT, `Máximo ${MAX_GRADE_LIMIT}.`),
);

const TOO_MANY_DECIMALS = "Tiene más decimales de los admitidos.";

/** Mismas reglas que la API (PUT /settings/academic); la API vuelve a validarlo todo */
export const AcademicSettingsSchema = v.pipe(
  v.object({
    institution_name: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(2, "Mínimo 2 caracteres."),
      v.maxLength(150, "Máximo 150 caracteres."),
    ),
    period_type: v.picklist(PERIOD_TYPES, "Elige el tipo de periodo."),
    terms_count: v.pipe(
      v.string(),
      v.trim(),
      v.regex(/^\d{1,2}$/, "Escribe un número entero."),
      v.check(
        (text) => Number(text) >= 1 && Number(text) <= MAX_TERMS,
        `Entre 1 y ${MAX_TERMS} evaluaciones.`,
      ),
    ),
    term_label: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(2, "Mínimo 2 caracteres."),
      v.maxLength(30, "Máximo 30 caracteres."),
    ),
    weights_mode: v.picklist(["equal", "custom"]),
    term_weights: v.array(v.string()),
    min_grade: gradeText,
    max_grade: gradeText,
    passing_grade: gradeText,
    grade_decimals: v.picklist(["0", "1", "2"]),
    round_final_grade: v.boolean(),
  }),
  v.forward(
    v.partialCheck(
      [["min_grade"], ["max_grade"]],
      (input) => toNumber(input.min_grade) < toNumber(input.max_grade),
      "Debe ser mayor que la nota mínima.",
    ),
    ["max_grade"],
  ),
  v.forward(
    v.partialCheck(
      [["min_grade"], ["max_grade"], ["passing_grade"]],
      (input) => {
        const passing = toNumber(input.passing_grade);
        return toNumber(input.min_grade) < passing && passing <= toNumber(input.max_grade);
      },
      "Debe ser mayor que la mínima y no mayor que la máxima.",
    ),
    ["passing_grade"],
  ),
  // Ninguna nota de la escala puede tener más decimales de los admitidos
  v.forward(
    v.partialCheck(
      [["min_grade"], ["grade_decimals"]],
      (input) => fitsDecimals(input.min_grade, Number(input.grade_decimals)),
      TOO_MANY_DECIMALS,
    ),
    ["min_grade"],
  ),
  v.forward(
    v.partialCheck(
      [["max_grade"], ["grade_decimals"]],
      (input) => fitsDecimals(input.max_grade, Number(input.grade_decimals)),
      TOO_MANY_DECIMALS,
    ),
    ["max_grade"],
  ),
  v.forward(
    v.partialCheck(
      [["passing_grade"], ["grade_decimals"]],
      (input) => fitsDecimals(input.passing_grade, Number(input.grade_decimals)),
      TOO_MANY_DECIMALS,
    ),
    ["passing_grade"],
  ),
  v.forward(
    v.partialCheck(
      [["weights_mode"], ["term_weights"]],
      (input) => input.weights_mode === "equal" || weightsAreValid(input.term_weights),
      "Cada porcentaje debe ser mayor que 0, con hasta 2 decimales, y entre todos sumar 100.",
    ),
    ["term_weights"],
  ),
);

export type SettingsFormValues = {
  institution_name: string;
  period_type: PeriodType;
  terms_count: string;
  term_label: string;
  weights_mode: "equal" | "custom";
  term_weights: string[];
  min_grade: string;
  max_grade: string;
  passing_grade: string;
  grade_decimals: string;
  round_final_grade: boolean;
};

export function toFormValues(settings: AcademicSettings): SettingsFormValues {
  return {
    institution_name: settings.institution_name,
    period_type: settings.period_type,
    terms_count: String(settings.terms_count),
    term_label: settings.term_label,
    weights_mode: settings.term_weights ? "custom" : "equal",
    term_weights: settings.term_weights
      ? settings.term_weights.map(scaleText)
      : evenWeights(settings.terms_count),
    min_grade: scaleText(settings.min_grade),
    max_grade: scaleText(settings.max_grade),
    passing_grade: scaleText(settings.passing_grade),
    grade_decimals: String(settings.grade_decimals),
    round_final_grade: settings.round_final_grade,
  };
}

export function toUpdateBody(values: SettingsFormValues): AcademicSettingsUpdate {
  return {
    institution_name: values.institution_name.trim(),
    period_type: values.period_type,
    terms_count: Number(values.terms_count),
    term_label: values.term_label.trim(),
    term_weights: values.weights_mode === "custom" ? values.term_weights.map(toNumber) : null,
    min_grade: toNumber(values.min_grade),
    max_grade: toNumber(values.max_grade),
    passing_grade: toNumber(values.passing_grade),
    grade_decimals: Number(values.grade_decimals),
    round_final_grade: values.round_final_grade,
  };
}

/** Lapsos que hay que mostrar mientras se escribe (1 si el número aún no es válido) */
const termsCountOf = (text: string) => {
  const count = Number(text);
  return Number.isInteger(count) && count >= 1 && count <= MAX_TERMS ? count : null;
};

/** Frase de la regla con los valores del formulario (la misma que devolverá la API) */
export function previewRule(values: SettingsFormValues): string {
  const count = termsCountOf(values.terms_count) ?? "?";
  const label = values.term_label.trim() || "Lapso";
  const kind = values.weights_mode === "equal" ? "promedio simple" : "promedio ponderado";
  const rounding = values.round_final_grade ? ", redondeado al entero (9.5 → 10)" : "";
  const passing = values.passing_grade.trim().replace(",", ".") || "?";
  return `La definitiva es el ${kind} de los ${count} ${termLabelPlural(label).toLowerCase()}${rounding} y se aprueba con ${passing} o más.`;
}

/** Formulario de la configuración académica (solo super admin) */
export function AcademicSettingsForm({ settings }: { settings: AcademicSettings }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: toFormValues(settings),
    validators: { onSubmit: AcademicSettingsSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        const saved = await updateAcademicSettings(toUpdateBody(value));
        await applyAcademicSettings(queryClient, saved);
        form.reset(toFormValues(saved));
        toast.success("Configuración guardada.");
      } catch (error) {
        const general = applyApiErrors(form, error);
        // 422 de reglas combinadas (mínima < máxima, pesos…): la API explica cuál falla
        const rule = isApiError(error) ? error.fieldErrors._ : undefined;
        setFormError(rule ? rule.replace(/^Value error, /, "") : general);
      }
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const count = termsCountOf(values.terms_count) ?? 1;
  const label = values.term_label.trim() || "Lapso";
  const total = weightsTotal(values.term_weights);

  /**
   * El error de los porcentajes es del conjunto (no de una casilla): al cambiar cualquiera se
   * quita, como hace TanStack Form con el campo editado, para que se pueda volver a enviar.
   */
  const clearWeightsError = () => {
    if (!form.getFieldMeta("term_weights")?.errorMap.onSubmit) return;
    form.setFieldMeta("term_weights", (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onSubmit: undefined },
    }));
  };

  /** El número de porcentajes sigue al número de evaluaciones */
  const resizeWeights = (text: string) => {
    clearWeightsError();
    const next = termsCountOf(text);
    const current = form.getFieldValue("term_weights");
    if (next == null || current.length === next) return;
    form.setFieldValue("term_weights", evenWeights(next));
  };

  return (
    <form
      noValidate
      className="flex w-full max-w-3xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div role="note" className="alert alert-warning alert-soft">
        <TriangleAlert className="size-5 shrink-0" />
        <span>
          Los cambios afectan a todas las pantallas de notas, a la importación desde Excel y al
          asistente IA. La API rechaza los cambios que dejarían inválidas notas ya cargadas (por
          ejemplo, reducir las evaluaciones si hay notas en las últimas o cambiar la escala si
          quedan notas fuera).
        </span>
      </div>
      <FormError message={formError} />

      <section className="card card-border bg-base-100">
        <div className="card-body gap-2">
          <h2 className="card-title">Institución</h2>
          <form.AppField name="institution_name">
            {(field) => (
              <field.TextField label="Nombre de la institución" placeholder="Ej. UNEFA" />
            )}
          </form.AppField>
          <form.AppField name="period_type">
            {(field) => (
              <field.SelectField
                label="Tipo de periodo"
                hint="Cómo se organiza el año académico."
                options={PERIOD_OPTIONS}
              />
            )}
          </form.AppField>
        </div>
      </section>

      <section className="card card-border bg-base-100">
        <div className="card-body gap-2">
          <h2 className="card-title">Evaluaciones</h2>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <form.AppField
              name="terms_count"
              listeners={{ onChange: ({ value }) => resizeWeights(value) }}
            >
              {(field) => (
                <field.TextField
                  label="Número de evaluaciones por periodo"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TERMS}
                  hint={`De 1 a ${MAX_TERMS}.`}
                />
              )}
            </form.AppField>
            <form.AppField name="term_label">
              {(field) => (
                <field.TextField
                  label="Nombre de cada evaluación"
                  placeholder="Ej. Lapso, Corte, Parcial"
                />
              )}
            </form.AppField>
          </div>

          <form.Field name="weights_mode" listeners={{ onChange: clearWeightsError }}>
            {(field) => (
              <fieldset className="fieldset">
                <legend className="fieldset-legend text-sm">Peso de las evaluaciones</legend>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    className="radio radio-primary radio-sm"
                    name={field.name}
                    checked={field.state.value === "equal"}
                    onChange={() => field.handleChange("equal")}
                  />
                  Todas pesan igual
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    className="radio radio-primary radio-sm"
                    name={field.name}
                    checked={field.state.value === "custom"}
                    onChange={() => field.handleChange("custom")}
                  />
                  Porcentajes personalizados
                </label>
              </fieldset>
            )}
          </form.Field>

          {values.weights_mode === "custom" && (
            <form.Field name="term_weights" mode="array">
              {(field) => {
                const error = field.state.meta.errors
                  .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message))
                  .find(Boolean);
                return (
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                      {termNumbers({ terms_count: Math.min(count, field.state.value.length) }).map(
                        (term) => (
                          <form.AppField
                            key={term}
                            name={`term_weights[${term - 1}]`}
                            listeners={{ onChange: clearWeightsError }}
                          >
                            {(weight) => (
                              <weight.TextField
                                label={`${label} ${term} (%)`}
                                inputMode="decimal"
                              />
                            )}
                          </form.AppField>
                        ),
                      )}
                    </div>
                    <p
                      className={`font-semibold text-sm ${total === 100 ? "text-success" : "text-error"}`}
                      aria-live="polite"
                    >
                      Total: {scaleText(total)} % {total === 100 ? "✓" : "(debe ser 100 %)"}
                    </p>
                    {error && (
                      <p className="text-error text-sm" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </form.Field>
          )}
        </div>
      </section>

      <section className="card card-border bg-base-100">
        <div className="card-body gap-2">
          <h2 className="card-title">Escala de notas</h2>
          <div className="grid gap-x-3 sm:grid-cols-3">
            <form.AppField name="min_grade">
              {(field) => <field.TextField label="Nota mínima" inputMode="decimal" />}
            </form.AppField>
            <form.AppField name="max_grade">
              {(field) => (
                <field.TextField label="Nota máxima" inputMode="decimal" hint="Hasta 100." />
              )}
            </form.AppField>
            <form.AppField name="passing_grade">
              {(field) => <field.TextField label="Nota aprobatoria" inputMode="decimal" />}
            </form.AppField>
          </div>
          <form.AppField name="grade_decimals">
            {(field) => <field.SelectField label="Decimales admitidos" options={DECIMAL_OPTIONS} />}
          </form.AppField>
          <form.Field name="round_final_grade">
            {(field) => (
              <label className="mt-2 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                />
                Redondear la definitiva al entero (9,5 → 10)
              </label>
            )}
          </form.Field>
        </div>
      </section>

      <section className="card bg-primary/10" aria-label="Vista previa de la regla">
        <div className="card-body gap-1">
          <h2 className="font-bold">Vista previa</h2>
          <p data-testid="settings-preview">{previewRule(values)}</p>
          <p className="text-base-content/70 text-sm">
            Notas del {values.min_grade || "?"} al {values.max_grade || "?"},{" "}
            {decimalsText(Number(values.grade_decimals))}.
            {values.weights_mode === "custom" &&
              ` Pesos: ${values.term_weights
                .slice(0, count)
                .map((w, i) => `${label} ${i + 1} ${w || "?"} %`)
                .join(" · ")}.`}
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton label="Guardar configuración" />
        </form.AppForm>
      </div>
    </form>
  );
}
