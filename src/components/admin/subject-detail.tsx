import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { api, unwrap } from "@/api/client";
import {
  activeTeachersQuery,
  adminKeys,
  type SectionRead,
  type SubjectRead,
  semesterSectionsQuery,
  subjectStudentsQuery,
  subjectTeachersQuery,
  type UserRead,
  usersQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { documentNoun } from "@/components/form/document-fields";
import { GradeHistory } from "@/components/grade-history";
import { confirm } from "@/components/ui/confirm";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { ACADEMIC_LABEL } from "@/lib/roles";
import { Section } from "./common";
import { addSubjectToTeacher, removeSubjectFromTeacher } from "./subject-form";

/**
 * Profesor de la materia en cada sección de su periodo: uno solo por sección, así cada
 * estudiante tiene un único profesor en la materia (el de su sección).
 */
export function SubjectTeachers({ subject }: { subject: SubjectRead }) {
  const settings = useAcademicSettings();
  const assigned = useQuery(subjectTeachersQuery(subject.id));
  const sections = useQuery(semesterSectionsQuery(subject.semester.id));
  const teachers = useQuery(activeTeachersQuery);

  let content: React.ReactNode;
  if (assigned.error || sections.error) {
    content = (
      <ErrorState error={assigned.error ?? sections.error} onRetry={() => assigned.refetch()} />
    );
  } else if (!assigned.data || !sections.data) {
    content = <LoadingState rows={1} />;
  } else if (sections.data.length === 0) {
    content = (
      <p className="font-semibold text-warning text-sm">
        El {settings.period_label.toLowerCase()} {subject.semester.name} no tiene secciones: créalas
        en {ACADEMIC_LABEL} para asignar profesores.
      </p>
    );
  } else {
    content = (
      <ul className="flex flex-col gap-2">
        {sections.data.map((section) => (
          <SectionTeacherRow
            key={section.id}
            subject={subject}
            section={section}
            teacher={assigned.data.find((a) => a.section.id === section.id)?.teacher}
            teachers={teachers.data?.items ?? []}
          />
        ))}
      </ul>
    );
  }

  return (
    <Section
      title="Profesores por sección"
      description="Cada sección tiene un solo profesor, que carga y edita las notas de sus estudiantes."
    >
      {content}
    </Section>
  );
}

function SectionTeacherRow({
  subject,
  section,
  teacher,
  teachers,
}: {
  subject: SubjectRead;
  section: SectionRead;
  teacher: UserRead | undefined;
  teachers: UserRead[];
}) {
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = useState("");

  const refresh = async (id: number) => {
    await queryClient.invalidateQueries({ queryKey: adminKeys.subjectTeachers(subject.id) });
    await queryClient.invalidateQueries({ queryKey: adminKeys.teacherSubjects(id) });
    await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
  };

  const assign = useMutation({
    mutationFn: (id: number) => addSubjectToTeacher(queryClient, id, subject.id, section.id),
    onSuccess: async (_, id) => {
      setTeacherId("");
      await refresh(id);
      toast.success(`Profesor asignado a la sección ${section.name}.`);
    },
    // 409: la sección ya tiene profesor
    onError: (error) => toast.error(error.message),
  });

  const unassign = useMutation({
    mutationFn: (current: UserRead) =>
      removeSubjectFromTeacher(queryClient, current.id, subject.id, section.id),
    onSuccess: async (_, current) => {
      await refresh(current.id);
      toast.success("Profesor quitado de la sección.");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleUnassign = async (current: UserRead) => {
    const ok = await confirm({
      title: `¿Quitar a ${current.full_name} de la sección ${section.name}?`,
      message: "Dejará de poder cargar notas de esta materia en esa sección.",
      confirmLabel: "Quitar",
      danger: true,
    });
    if (ok) unassign.mutate(current);
  };

  return (
    <li className="flex flex-col gap-2 rounded-field border border-base-300 px-3 py-2 sm:flex-row sm:items-center">
      <span className="font-semibold sm:w-28">Sección {section.name}</span>
      {teacher ? (
        <span className="flex flex-1 items-center gap-2">
          <span className="badge badge-outline badge-primary badge-lg gap-1">
            {teacher.full_name}
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              aria-label={`Quitar a ${teacher.full_name} de la sección ${section.name}`}
              onClick={() => handleUnassign(teacher)}
            >
              <X className="size-3.5" />
            </button>
          </span>
        </span>
      ) : (
        <form
          className="flex flex-1 flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (teacherId) assign.mutate(Number(teacherId));
          }}
        >
          <select
            className="select select-sm w-full sm:max-w-xs"
            aria-label={`Profesor de la sección ${section.name}`}
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            <option value="">Sin profesor: selecciona uno…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn-outline btn-primary btn-sm"
            disabled={!teacherId || assign.isPending}
          >
            Asignar
          </button>
        </form>
      )}
    </li>
  );
}

/** Estudiantes matriculados en la materia: buscar, quitar y matricular varios */
export function SubjectStudents({ subject }: { subject: SubjectRead }) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const documentLabel = settings.document_label;
  const closed = subject.semester.is_closed;
  const closedHint = `El ${settings.period_label.toLowerCase()} está cerrado`;
  const students = useQuery(subjectStudentsQuery(subject.id));
  const [filter, setFilter] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const withdraw = useMutation({
    mutationFn: (student: UserRead) =>
      unwrap(
        api.DELETE("/api/v1/students/{student_id}/subjects/{subject_id}", {
          params: { path: { student_id: student.id, subject_id: subject.id } },
        }),
      ),
    onSuccess: async (_, student) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjectStudents(subject.id) });
      await queryClient.invalidateQueries({ queryKey: adminKeys.studentSubjects(student.id) });
      toast.success("Estudiante retirado de la materia.");
    },
    // 409: tiene notas cargadas
    onError: (error) => toast.error(error.message),
  });

  const handleWithdraw = async (student: UserRead) => {
    const ok = await confirm({
      title: `¿Quitar a ${student.full_name} de la materia?`,
      message: "Solo es posible si aún no tiene notas en la materia.",
      confirmLabel: "Quitar",
      danger: true,
    });
    if (ok) withdraw.mutate(student);
  };

  const term = filter.trim().toLowerCase();
  const rows = students.data?.filter(
    (s) =>
      !term ||
      s.full_name.toLowerCase().includes(term) ||
      (s.cedula_display ?? "").toLowerCase().includes(term),
  );

  return (
    <Section
      title="Estudiantes matriculados"
      description={students.data ? `${students.data.length} estudiantes` : undefined}
      actions={
        <button
          type="button"
          className="btn btn-primary"
          disabled={closed}
          title={closed ? closedHint : undefined}
          onClick={() => setEnrolling(true)}
        >
          <Plus className="size-4" />
          Matricular estudiantes
        </button>
      }
    >
      <SearchInput
        value={filter}
        onChange={setFilter}
        placeholder={`Buscar por nombre o ${documentNoun(documentLabel)}`}
      />
      <DataTable
        rows={rows}
        isLoading={students.isPending}
        error={students.error}
        onRetry={() => students.refetch()}
        rowKey={(s) => s.id}
        emptyTitle={
          term ? "Sin resultados para la búsqueda" : "Aún no hay estudiantes matriculados"
        }
        columns={[
          { header: "Estudiante", cell: (s) => s.full_name },
          { header: documentLabel, cell: (s) => s.cedula_display },
          {
            header: "Acciones",
            cell: (s) => (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                disabled={closed}
                title={closed ? closedHint : undefined}
                onClick={() => handleWithdraw(s)}
              >
                Quitar de la materia
              </button>
            ),
          },
        ]}
        renderCard={(s) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold">{s.full_name}</p>
              <p className="text-base-content/70 text-sm">{s.cedula_display}</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              disabled={closed}
              title={closed ? closedHint : undefined}
              onClick={() => handleWithdraw(s)}
            >
              Quitar
            </button>
          </div>
        )}
      />
      {enrolling && (
        <EnrollStudentsModal
          subject={subject}
          enrolledIds={new Set(students.data?.map((s) => s.id))}
          onClose={() => setEnrolling(false)}
        />
      )}
    </Section>
  );
}

/** Matrícula masiva: buscar estudiantes activos y marcar varios */
function EnrollStudentsModal({
  subject,
  enrolledIds,
  onClose,
}: {
  subject: SubjectRead;
  enrolledIds: Set<number>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const settings = useAcademicSettings();
  const documentLabel = settings.document_label;
  const [selected, setSelected] = useState<Map<number, UserRead>>(new Map());
  const candidates = useQuery(usersQuery("students", { q, is_active: true }));

  const enroll = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/subjects/{subject_id}/students", {
          params: { path: { subject_id: subject.id } },
          body: { student_ids: [...selected.keys()] },
        }),
      ),
    onSuccess: async ({ added, already_enrolled }) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjectStudents(subject.id) });
      for (const id of selected.keys()) {
        await queryClient.invalidateQueries({ queryKey: adminKeys.studentSubjects(id) });
      }
      toast.success(
        already_enrolled > 0
          ? `${added} matriculados; ${already_enrolled} ya lo estaban.`
          : `${added} estudiantes matriculados.`,
      );
      onClose();
    },
    // 409: alguno no tiene sección en el periodo (la API dice quiénes)
    onError: (error) => toast.error(error.message),
  });

  const toggle = (student: UserRead) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(student.id)) next.delete(student.id);
      else next.set(student.id, student);
      return next;
    });

  const list = candidates.data?.items.filter((s) => !enrolledIds.has(s.id));

  return (
    <Modal open title={`Matricular en ${subject.code}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-base-content/70 text-sm">
          Solo se pueden matricular estudiantes con sección en el{" "}
          {settings.period_label.toLowerCase()} {subject.semester.name}; su profesor será el de su
          sección.
        </p>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={`Buscar por nombre o ${documentNoun(documentLabel)}`}
        />
        <div className="max-h-72 overflow-y-auto">
          {candidates.error ? (
            <ErrorState error={candidates.error} onRetry={() => candidates.refetch()} />
          ) : !list ? (
            <LoadingState rows={3} />
          ) : list.length === 0 ? (
            <EmptyState title="No hay estudiantes por matricular" />
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((student) => (
                <li key={student.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-field px-2 py-1.5 hover:bg-base-200">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selected.has(student.id)}
                      onChange={() => toggle(student)}
                    />
                    <span className="flex-1">{student.full_name}</span>
                    <span className="text-base-content/60 text-sm">{student.cedula_display}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.size === 0 || enroll.isPending}
            onClick={() => enroll.mutate()}
          >
            Matricular {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Botón para eliminar la materia (solo si no tiene estudiantes) */
export function DeleteSubjectButton({ subject }: { subject: SubjectRead }) {
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        api.DELETE("/api/v1/subjects/{subject_id}", {
          params: { path: { subject_id: subject.id } },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
      toast.success(`Materia ${subject.code} eliminada.`);
      await navigate({ to: "/admin/academic", search: { semester: subject.semester.id } });
    },
    // 409: tiene estudiantes matriculados
    onError: (error) => toast.error(error.message),
  });

  const handleDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar ${subject.code} · ${subject.name}?`,
      message: "Solo se puede eliminar si no tiene estudiantes matriculados.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate();
  };

  // La API no deja eliminar materias de un periodo cerrado (409): se conserva su historial
  const closed = subject.semester.is_closed;
  return (
    <button
      type="button"
      className="btn btn-outline btn-error"
      disabled={remove.isPending || closed}
      title={closed ? `El ${settings.period_label.toLowerCase()} está cerrado` : undefined}
      onClick={handleDelete}
    >
      Eliminar
    </button>
  );
}

/** Historial de cambios de notas de la materia, con filtro opcional por estudiante */
export function SubjectGradeHistory({ subject }: { subject: SubjectRead }) {
  const students = useQuery(subjectStudentsQuery(subject.id));
  const [studentId, setStudentId] = useState("");

  return (
    <Section
      title="Historial de notas"
      description="Cada nota cargada, corregida o borrada: quién lo hizo, cuándo y cómo."
    >
      <select
        className="select w-full sm:max-w-md"
        aria-label="Filtrar el historial por estudiante"
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
      >
        <option value="">Todos los estudiantes</option>
        {students.data?.map((student) => (
          <option key={student.id} value={student.id}>
            {student.full_name}
          </option>
        ))}
      </select>
      <GradeHistory
        key={studentId}
        scope={{ kind: "admin" }}
        subject={subject}
        studentId={studentId ? Number(studentId) : undefined}
      />
    </Section>
  );
}
