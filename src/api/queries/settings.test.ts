import { describe, expect, it } from "vitest";
import { DEFAULT_ACADEMIC_SETTINGS, type GradingRules, rulesFor } from "./settings";

const current = {
  ...DEFAULT_ACADEMIC_SETTINGS,
  institution_name: "UNEFA",
  terms_count: 4,
  term_label: "Corte",
  term_label_plural: "Cortes",
  min_grade: 0,
  max_grade: 100,
  passing_grade: 60,
  grade_decimals: 0,
};

const frozen: GradingRules = {
  terms_count: 3,
  term_label: "Lapso",
  term_label_plural: "Lapsos",
  term_weights: null,
  term_percentages: [33.33, 33.33, 33.33],
  min_grade: 1,
  max_grade: 20,
  passing_grade: 10,
  grade_decimals: 2,
  round_final_grade: false,
  summary: "La definitiva es el promedio simple de los 3 lapsos y se aprueba con 10 o más",
};

describe("rulesFor", () => {
  it("sin reglas propias el periodo sigue la configuración vigente", () => {
    expect(rulesFor({ rules: null }, current)).toBe(current);
    expect(rulesFor(undefined, current)).toBe(current);
  });

  it("las reglas congeladas mandan; los nombres siguen saliendo de la configuración", () => {
    const rules = rulesFor({ rules: frozen }, current);
    expect(rules).toMatchObject({ terms_count: 3, term_label: "Lapso", max_grade: 20 });
    expect(rules.institution_name).toBe("UNEFA");
    expect(rules.period_label).toBe(current.period_label);
  });
});
