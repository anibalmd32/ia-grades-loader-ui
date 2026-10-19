import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import {
  createEvaluation,
  deleteEvaluation,
  type Evaluation,
  type EvaluationGradeEntry,
  evaluationGradeOf,
  evaluationKeys,
  percentText,
  type StudentEvaluationGrades,
  saveEvaluationGrades,
  type TermEvaluationGrades,
  type TermPlan,
  updateEvaluation,
} from "@/api/queries/evaluations";
import { gradeHistoryKeys } from "@/api/queries/grade-history";
import type { AcademicSettings } from "@/api/queries/settings";
import { studentKeys } from "@/api/queries/student";
import { teacherKeys } from "@/api/queries/teacher";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { GradeCell } from "@/components/teacher/gradebook";
import { confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { dueDateText } from "@/lib/dates";
import { formatGrade, gradeRule, gradeText, parseGrade, termName } from "@/lib/grades";

/** Tras cambiar el plan o sus notas cambian la planilla, el historial y lo que ve el estudiante */
function invalidateAfterChange(queryClient: ReturnType<typeof useQueryClient>, subjectId: number) {
  void queryClient.invalidateQueries({ queryKey: evaluationKeys.all });
  void queryClient.invalidateQueries({ queryKey: teacherKeys.grades(subjectId) });
  void queryClient.invalidateQueries({ queryKey: teacherKeys.subjects });
  void queryClient.invalidateQueries({ queryKey: gradeHistoryKeys.all });
  void queryClient.invalidateQueries({ queryKey: studentKeys.all });
}

/** Estado del plan de un lapso: completo (100 %), a medias o sin evaluaciones */
export function PlanBadge({ plan }: { plan: TermPlan }) {
  if (plan.evaluations_count === 0) {
    return <span className="badge badge-ghost badge-sm">Carga directa</span>;
  }
  return (
    <span
      className={`badge badge-soft badge-sm ${plan.complete ? "badge-success" : "badge-warning"}`}
    >
      {percentText(plan.weights_total)}
    </span>
  );
}

/** Explicación del plan de un lapso según su estado */
export function PlanNotice({ plan, settings }: { plan: TermPlan; settings: AcademicSettings }) {
  const term = termName(settings, plan.term);
  if (plan.evaluations_count === 0) {
    return (
      <p className="text-base-content/70 text-sm">
        La nota del {term.toLowerCase()} se carga directamente en la planilla. Si añades
        evaluaciones (exámenes, talleres…), se calculará sola con sus notas y porcentajes.
      </p>
    );
  }
  if (plan.complete) {
    return (
      <p className="text-base-content/70 text-sm">
        El plan suma 100 %: la nota del {term.toLowerCase()} de cada estudiante se calcula al tener
        todas sus evaluaciones calificadas.
      </p>
    );
  }
  return (
    <div role="alert" className="alert alert-warning alert-soft">
      <span>
        El plan suma {percentText(plan.weights_total)}. La nota del {term.toLowerCase()} se
        calculará cuando los porcentajes sumen 100 %.
      </span>
    </div>
  );
}

/** Evaluaciones del lapso con sus acciones */
export function EvaluationList({
  evaluations,
  readOnly,
  onEdit,
  onDelete,
}: {
  evaluations: Evaluation[];
  readOnly: boolean;
  onEdit: (evaluation: Evaluation) => void;
  onDelete: (evaluation: Evaluation) => void;
}) {
  return (
    <ul className="divide-y divide-base-300">
      {evaluations.map((evaluation) => (
        <li key={evaluation.id} className="flex items-center gap-3 py-3">
          <span className="badge badge-primary badge-soft w-16 shrink-0 font-bold tabular-nums">
            {percentText(evaluation.weight)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{evaluation.name}</p>
            <p className="flex items-center gap-1 text-base-content/70 text-xs">
              {evaluation.due_date && (
                <>
                  <CalendarDays className="size-3" />
                  {dueDateText(evaluation.due_date)} ·{" "}
                </>
              )}
              {evaluation.graded_count === 1
                ? "1 calificado"
                : `${evaluation.graded_count} calificados`}
            </p>
          </div>
          {!readOnly && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                aria-label={`Editar ${evaluation.name}`}
                onClick={() => onEdit(evaluation)}
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square text-error"
                aria-label={`Eliminar ${evaluation.name}`}
                onClick={() => onDelete(evaluation)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Pide confirmación y borra la evaluación (con sus notas) */
export function useDeleteEvaluation(subjectId: number, settings: AcademicSettings) {
  const queryClient = useQueryClient();
  return async (evaluation: Evaluation) => {
    const graded = evaluation.graded_count;
    const ok = await confirm({
      title: `¿Eliminar «${evaluation.name}»?`,
      message:
        graded > 0
          ? `Se borrarán también sus ${graded} ${graded === 1 ? "nota" : "notas"} y se recalculará la nota del ${termName(settings, evaluation.term).toLowerCase()}.`
          : `Se quitará del plan del ${termName(settings, evaluation.term).toLowerCase()}.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEvaluation(subjectId, evaluation.id);
      invalidateAfterChange(queryClient, subjectId);
      toast.success("Evaluación eliminada.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
}

const EvaluationSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Escribe el nombre de la evaluación"),
    v.maxLength(100, "Máximo 100 caracteres"),
  ),
  weight: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("Indica el porcentaje"),
    v.check(
      (text) => /^\d{1,3}([.,]\d{1,2})?$/.test(text) && Number(text.replace(",", ".")) > 0,
      "Porcentaje entre 0 y 100 (hasta 2 decimales)",
    ),
    v.check((text) => Number(text.replace(",", ".")) <= 100, "No puede pasar del 100 %"),
  ),
  due_date: v.string(),
});

/** Alta o edición de una evaluación del lapso */
export function EvaluationFormModal({
  subjectId,
  term,
  evaluation,
  available,
  settings,
  onClose,
}: {
  subjectId: number;
  term: number;
  /** Sin evaluación: alta */
  evaluation?: Evaluation;
  /** Porcentaje que queda libre en el lapso (sin contar el de esta evaluación) */
  available: number;
  settings: AcademicSettings;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {
      name: evaluation?.name ?? "",
      weight: evaluation ? String(evaluation.weight) : available > 0 ? String(available) : "",
      due_date: evaluation?.due_date ?? "",
    },
    validators: { onSubmit: EvaluationSchema },
    onSubmit: async ({ value }) => {
      const body = {
        name: value.name.trim(),
        weight: Number(value.weight.replace(",", ".")),
        due_date: value.due_date || null,
      };
      try {
        if (evaluation) await updateEvaluation(subjectId, evaluation.id, body);
        else await createEvaluation(subjectId, { term, ...body });
        invalidateAfterChange(queryClient, subjectId);
        toast.success(evaluation ? "Evaluación actualizada." : "Evaluación añadida.");
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal
      open
      title={
        evaluation
          ? `Editar «${evaluation.name}»`
          : `Nueva evaluación · ${termName(settings, term)}`
      }
      onClose={onClose}
    >
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <form.AppField name="name">
          {(field) => <field.TextField label="Nombre" placeholder="Parcial 1, Taller…" />}
        </form.AppField>
        <form.AppField name="weight">
          {(field) => (
            <field.TextField
              label="Porcentaje del lapso"
              inputMode="decimal"
              hint={`Quedan ${percentText(Math.max(available, 0))} libres en el ${termName(settings, term).toLowerCase()}`}
            />
          )}
        </form.AppField>
        <form.AppField name="due_date">
          {(field) => <field.TextField label="Fecha (opcional)" type="date" />}
        </form.AppField>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <form.AppForm>
            <form.SubmitButton label={evaluation ? "Guardar" : "Añadir"} />
          </form.AppForm>
        </div>
      </form>
    </Modal>
  );
}

const cellKey = (studentId: number, evaluationId: number) => `${studentId}:${evaluationId}`;

/** Celdas editadas de la hoja de evaluaciones (como la planilla, pero por evaluación) */
export function useEvaluationDrafts(data: TermEvaluationGrades, settings: AcademicSettings) {
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());

  const text = (row: StudentEvaluationGrades, evaluationId: number) =>
    drafts.get(cellKey(row.student.id, evaluationId)) ??
    gradeText(evaluationGradeOf(row, evaluationId), settings);

  const changes: EvaluationGradeEntry[] = [];
  const invalid: { row: StudentEvaluationGrades; evaluation: Evaluation }[] = [];
  const edited = new Set<string>();
  for (const row of data.students) {
    for (const evaluation of data.evaluations) {
      const key = cellKey(row.student.id, evaluation.id);
      const draft = drafts.get(key);
      if (draft === undefined) continue;
      const parsed = parseGrade(draft, settings);
      if (!parsed.valid) {
        invalid.push({ row, evaluation });
        edited.add(key);
      } else if (parsed.value !== evaluationGradeOf(row, evaluation.id)) {
        changes.push({
          student_id: row.student.id,
          evaluation_id: evaluation.id,
          value: parsed.value,
        });
        edited.add(key);
      }
    }
  }

  return {
    text,
    changes,
    invalid,
    pending: edited.size,
    isEdited: (row: StudentEvaluationGrades, evaluationId: number) =>
      edited.has(cellKey(row.student.id, evaluationId)),
    isInvalid: (row: StudentEvaluationGrades, evaluationId: number) =>
      invalid.some((c) => c.row === row && c.evaluation.id === evaluationId),
    set: (row: StudentEvaluationGrades, evaluationId: number, value: string) =>
      setDrafts((prev) => new Map(prev).set(cellKey(row.student.id, evaluationId), value)),
    reset: () => setDrafts(new Map()),
  };
}

export type EvaluationDrafts = ReturnType<typeof useEvaluationDrafts>;

export function useSaveEvaluationGrades(subjectId: number, term: number, drafts: EvaluationDrafts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: EvaluationGradeEntry[]) => saveEvaluationGrades(subjectId, term, changes),
    onSuccess: (data, changes) => {
      queryClient.setQueryData(evaluationKeys.grades(subjectId, term), data);
      invalidateAfterChange(queryClient, subjectId);
      drafts.reset();
      toast.success(
        changes.length === 1 ? "1 nota guardada." : `${changes.length} notas guardadas.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Primera celda inválida de la hoja */
export function InvalidEvaluationAlert({
  drafts,
  settings,
}: {
  drafts: EvaluationDrafts;
  settings: AcademicSettings;
}) {
  const first = drafts.invalid[0];
  if (!first) return null;
  const more = drafts.invalid.length - 1;
  return (
    <div role="alert" className="alert alert-error alert-soft">
      <span>
        {first.row.student.full_name} · {first.evaluation.name}: {gradeRule(settings)}.
        {more > 0 && ` Hay ${more} ${more === 1 ? "celda más" : "celdas más"} por corregir.`}
      </span>
    </div>
  );
}

/** Nota del lapso calculada por la API, o lo acumulado mientras falten evaluaciones */
export function TermResult({
  row,
  settings,
}: {
  row: StudentEvaluationGrades;
  settings: AcademicSettings;
}) {
  if (row.term_grade != null) {
    return (
      <span
        className={`font-bold tabular-nums ${row.term_grade >= settings.passing_grade ? "text-success" : "text-error"}`}
      >
        {formatGrade(row.term_grade, settings)}
      </span>
    );
  }
  return <span className="font-semibold text-base-content/60">Pendiente</span>;
}

/** Hoja de notas de las evaluaciones de un lapso: tabla en escritorio, tarjetas en móvil */
export function EvaluationGradesSheet({
  data,
  drafts,
  settings,
  disabled,
}: {
  data: TermEvaluationGrades;
  drafts: EvaluationDrafts;
  settings: AcademicSettings;
  disabled: boolean;
}) {
  const { evaluations, students } = data;
  return (
    <>
      <ul className="card card-border divide-y divide-base-300 bg-base-100 lg:hidden">
        {students.map((row) => (
          <li key={row.student.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{row.student.full_name}</p>
                <p className="text-base-content/70 text-xs">
                  Acumulado: {formatGrade(row.accumulated, settings)}
                </p>
              </div>
              <TermResult row={row} settings={settings} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {evaluations.map((evaluation) => (
                <div key={evaluation.id} className="flex flex-col gap-1 text-xs">
                  <span className="truncate text-base-content/70">
                    {evaluation.name} ({percentText(evaluation.weight)})
                  </span>
                  <GradeCell
                    className="input-md"
                    label={`${row.student.full_name} · ${evaluation.name}`}
                    value={drafts.text(row, evaluation.id)}
                    edited={drafts.isEdited(row, evaluation.id)}
                    invalid={drafts.isInvalid(row, evaluation.id)}
                    onChange={(value) => drafts.set(row, evaluation.id, value)}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
        <table className="table-zebra table">
          <thead>
            <tr>
              <th>Estudiante</th>
              {evaluations.map((evaluation) => (
                <th key={evaluation.id} className="w-32">
                  <span className="block truncate">{evaluation.name}</span>
                  <span className="font-normal text-base-content/60">
                    {percentText(evaluation.weight)}
                  </span>
                </th>
              ))}
              <th className="w-28">Acumulado</th>
              <th className="w-32">{termName(settings, data.plan.term)}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((row) => (
              <tr key={row.student.id}>
                <td>
                  {row.student.full_name}
                  {row.student.cedula_display && (
                    <span className="text-base-content/70"> · {row.student.cedula_display}</span>
                  )}
                </td>
                {evaluations.map((evaluation) => (
                  <td key={evaluation.id}>
                    <GradeCell
                      label={`${row.student.full_name} · ${evaluation.name}`}
                      value={drafts.text(row, evaluation.id)}
                      edited={drafts.isEdited(row, evaluation.id)}
                      invalid={drafts.isInvalid(row, evaluation.id)}
                      onChange={(value) => drafts.set(row, evaluation.id, value)}
                      disabled={disabled}
                    />
                  </td>
                ))}
                <td className="tabular-nums">{formatGrade(row.accumulated, settings)}</td>
                <td>
                  <TermResult row={row} settings={settings} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
