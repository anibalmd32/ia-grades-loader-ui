import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SemesterRead } from "@/api/queries/admin";
import {
  type GradeChange,
  type GradeHistoryScope,
  gradeHistoryQuery,
} from "@/api/queries/grade-history";
import { type AcademicSettings, useSubjectRules } from "@/api/queries/settings";
import { Pagination } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { timeAgo } from "@/lib/dates";
import { formatGrade, termName } from "@/lib/grades";

type HistorySubject = { id: number; semester: SemesterRead };

const fullDate = new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" });

/** "15.00 → 16.00", "Nota nueva: 16.00" o "Nota borrada: 15.00" */
export function changeText(change: GradeChange, rules: AcademicSettings): string {
  if (change.old_value == null) return `Nota nueva: ${formatGrade(change.new_value, rules)}`;
  if (change.new_value == null) return `Nota borrada: ${formatGrade(change.old_value, rules)}`;
  return `${formatGrade(change.old_value, rules)} → ${formatGrade(change.new_value, rules)}`;
}

const SOURCE_LABEL: Record<GradeChange["source"], string> = {
  manual: "A mano",
  import: "Importación",
};

function HistoryEntry({
  change,
  rules,
  showStudent,
}: {
  change: GradeChange;
  rules: AcademicSettings;
  showStudent: boolean;
}) {
  return (
    <li className="flex flex-col gap-0.5 py-3">
      {showStudent && <p className="font-semibold text-sm">{change.student.full_name}</p>}
      <p className="font-bold tabular-nums">{changeText(change, rules)}</p>
      <p className="text-base-content/70 text-xs">
        {termName(rules, change.term)} · {change.changed_by ?? "Usuario eliminado"} ·{" "}
        <time dateTime={change.created_at} title={fullDate.format(new Date(change.created_at))}>
          {timeAgo(change.created_at)}
        </time>{" "}
        · {SOURCE_LABEL[change.source]}
      </p>
    </li>
  );
}

/**
 * Historial paginado de cambios de notas de una materia (del más reciente al más antiguo).
 * Con `studentId` solo los de ese estudiante. Las notas y lapsos siguen las reglas del periodo.
 */
export function GradeHistory({
  scope,
  subject,
  studentId,
}: {
  scope: GradeHistoryScope;
  subject: HistorySubject;
  studentId?: number;
}) {
  const rules = useSubjectRules(subject.semester);
  const [offset, setOffset] = useState(0);
  const history = useQuery(gradeHistoryQuery(scope, subject.id, { studentId, offset }));

  if (history.error) {
    return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  }
  if (!history.data) return <LoadingState rows={3} />;
  if (history.data.total === 0) {
    return (
      <EmptyState
        title="Sin cambios de notas"
        description="Aquí aparecerá cada nota que se cargue, corrija o borre."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ol className="divide-y divide-base-300" aria-label="Historial de notas">
        {history.data.items.map((change) => (
          <HistoryEntry
            key={change.id}
            change={change}
            rules={rules}
            showStudent={studentId === undefined}
          />
        ))}
      </ol>
      {history.data.total > history.data.limit && (
        <Pagination page={history.data} onPageChange={setOffset} />
      )}
    </div>
  );
}

/** Diálogo con el historial de la materia o de un estudiante */
export function GradeHistoryModal({
  scope,
  subject,
  student,
  onClose,
}: {
  scope: GradeHistoryScope;
  subject: HistorySubject;
  student?: { id: number; full_name: string };
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title={student ? `Historial de ${student.full_name}` : "Historial de notas"}
      onClose={onClose}
    >
      <div className="max-h-[60vh] overflow-y-auto">
        <GradeHistory scope={scope} subject={subject} studentId={student?.id} />
      </div>
      <div className="modal-action">
        <button type="button" className="btn" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
