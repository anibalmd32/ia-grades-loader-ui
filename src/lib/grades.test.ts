import { describe, expect, it } from "vitest";
import { DEFAULT_ACADEMIC_SETTINGS } from "@/api/queries/settings";
import {
  formatGrade,
  gradeRule,
  gradeText,
  isTerm,
  parseGrade,
  termName,
  termNumbers,
  termsText,
} from "./grades";

const defaults = DEFAULT_ACADEMIC_SETTINGS;
// Escala del 0 al 100, sin decimales, 4 cortes
const percent = {
  ...defaults,
  min_grade: 0,
  max_grade: 100,
  passing_grade: 60,
  grade_decimals: 0,
  terms_count: 4,
  term_label: "Corte",
  term_label_plural: "Cortes",
};

describe("notas según la configuración", () => {
  it("con la configuración de siempre: del 1 al 20 con hasta 2 decimales", () => {
    expect(parseGrade("15,75", defaults)).toEqual({ valid: true, value: 15.75 });
    expect(parseGrade("", defaults)).toEqual({ valid: true, value: null });
    expect(parseGrade("0.5", defaults)).toEqual({ valid: false });
    expect(parseGrade("20.01", defaults)).toEqual({ valid: false });
    expect(parseGrade("10.123", defaults)).toEqual({ valid: false });
    expect(gradeRule(defaults)).toBe("la nota debe estar entre 1 y 20, con hasta 2 decimales");
    expect(gradeText(15.5, defaults)).toBe("15.50");
    expect(formatGrade(null)).toBe("—");
  });

  it("con escala 0–100 sin decimales", () => {
    expect(parseGrade("85", percent)).toEqual({ valid: true, value: 85 });
    expect(parseGrade("0", percent)).toEqual({ valid: true, value: 0 });
    expect(parseGrade("100", percent)).toEqual({ valid: true, value: 100 });
    expect(parseGrade("85.5", percent)).toEqual({ valid: false });
    expect(parseGrade("101", percent)).toEqual({ valid: false });
    expect(gradeRule(percent)).toBe("la nota debe estar entre 0 y 100, sin decimales");
    expect(gradeRule({ ...percent, grade_decimals: 1 })).toBe(
      "la nota debe estar entre 0 y 100, con hasta 1 decimal",
    );
    expect(gradeText(85, percent)).toBe("85");
    expect(formatGrade(72.4, percent)).toBe("72");
  });

  it("lapsos configurados", () => {
    expect(termNumbers(percent)).toEqual([1, 2, 3, 4]);
    expect(isTerm(4, percent)).toBe(true);
    expect(isTerm(4, defaults)).toBe(false);
    expect(termName(percent, 2)).toBe("Corte 2");
    expect(termsText(percent, [4])).toBe("Corte 4");
    expect(termsText(percent, [2, 3, 4])).toBe("Cortes 2, 3 y 4");
  });
});
