import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, unwrap } from "@/api/client";
import {
  adminKeys,
  allSubjectsQuery,
  enrollStudentInSubjects,
  type SubjectRead,
  studentSubjectsQuery,
  subjectLabel,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { confirm } from "@/components/ui/confirm";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast";
import { Section } from "./common";

/** Materias del estudiante: matricular una a una y retirar (si no tiene notas) */
export function StudentEnrollments({ studentId, name }: { studentId: number; name: string }) {
  const settings = useAcademicSettings();
  const queryClient = useQueryClient();
  const enrolled = useQuery(studentSubjectsQuery(studentId));
  const subjects = useQuery(allSubjectsQuery);
  const [subjectId, setSubjectId] = useState("");

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.studentSubjects(studentId) });
    await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
  };

  const enroll = useMutation({
    mutationFn: (id: number) => enrollStudentInSubjects(studentId, [id]),
    onSuccess: async () => {
      setSubjectId("");
      await refresh();
      toast.success("Estudiante matriculado.");
    },
    onError: (error) => toast.error(error.message),
  });

  const withdraw = useMutation({
    mutationFn: (subject: SubjectRead) =>
      unwrap(
        api.DELETE("/api/v1/students/{student_id}/subjects/{subject_id}", {
          params: { path: { student_id: studentId, subject_id: subject.id } },
        }),
      ),
    onSuccess: async () => {
      await refresh();
      toast.success("Matrícula retirada.");
    },
    // 409: tiene notas cargadas en la materia
    onError: (error) => toast.error(error.message),
  });

  const handleWithdraw = async (subject: SubjectRead) => {
    const ok = await confirm({
      title: `¿Quitar ${subjectLabel(subject)}?`,
      message: `${name} dejará de estar matriculado. Solo es posible si aún no tiene notas en la materia.`,
      confirmLabel: "Quitar",
      danger: true,
    });
    if (ok) withdraw.mutate(subject);
  };

  const enrolledIds = new Set(enrolled.data?.map((s) => s.id));
  const available = subjects.data?.items.filter((s) => !enrolledIds.has(s.id)) ?? [];

  return (
    <Section
      title="Materias matriculadas"
      description={enrolled.data ? `${enrolled.data.length} materias` : undefined}
    >
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (subjectId) enroll.mutate(Number(subjectId));
        }}
      >
        <select
          className="select w-full sm:max-w-md"
          aria-label="Materia a matricular"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        >
          <option value="">Selecciona una materia…</option>
          {available.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subjectLabel(subject)} · {subject.semester.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={!subjectId || enroll.isPending}>
          Matricular
        </button>
      </form>
      <DataTable
        rows={enrolled.data}
        isLoading={enrolled.isPending}
        error={enrolled.error}
        onRetry={() => enrolled.refetch()}
        rowKey={(subject) => subject.id}
        emptyTitle="Sin materias matriculadas"
        columns={[
          { header: "Código", cell: (s) => s.code },
          { header: "Materia", cell: (s) => s.name },
          { header: settings.period_label, cell: (s) => s.semester.name },
          {
            header: "Acciones",
            cell: (s) => (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => handleWithdraw(s)}
              >
                Quitar
              </button>
            ),
          },
        ]}
        renderCard={(s) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold">{subjectLabel(s)}</p>
              <p className="text-base-content/70 text-sm">
                {settings.period_label} {s.semester.name}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              onClick={() => handleWithdraw(s)}
            >
              Quitar
            </button>
          </div>
        )}
      />
    </Section>
  );
}
