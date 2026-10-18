import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as v from "valibot";
import { api, unwrap } from "@/api/client";
import {
  activeTeachersQuery,
  adminKeys,
  type SubjectRead,
  semestersQuery,
  setTeacherSubjects,
  teacherSubjectsQuery,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

const SubjectSchema = v.object({
  semester_id: v.pipe(v.string(), v.minLength(1, "Elige uno de la lista.")),
  code: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el código."),
    v.maxLength(20, "Máximo 20 caracteres."),
  ),
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Escribe el nombre."),
    v.maxLength(150, "Máximo 150 caracteres."),
  ),
  teacher_id: v.string(),
});

/** Opciones del selector de periodo (semestre, trimestre…); los cerrados no admiten materias */
function useSemesterOptions() {
  const semesters = useQuery(semestersQuery);
  const settings = useAcademicSettings();
  const options = [
    { value: "", label: `Selecciona un ${settings.period_label.toLowerCase()}…` },
    ...(semesters.data ?? []).map((s) => ({
      value: String(s.id),
      label: s.is_closed ? `${s.name} (cerrado)` : s.name,
      disabled: s.is_closed,
    })),
  ];
  const isClosed = (id: string) => semesters.data?.some((s) => String(s.id) === id && s.is_closed);
  return { options, isClosed };
}

/** Añade la materia al profesor sin quitarle las que ya tiene */
export async function addSubjectToTeacher(
  queryClient: ReturnType<typeof useQueryClient>,
  teacherId: number,
  subjectId: number,
) {
  const current = await queryClient.fetchQuery(teacherSubjectsQuery(teacherId));
  const ids = new Set(current.map((s) => s.id));
  ids.add(subjectId);
  await setTeacherSubjects(teacherId, [...ids]);
}

/** Alta de materia: periodo (semestre…), código, nombre y profesor opcional */
export function SubjectCreateForm({ defaultSemesterId }: { defaultSemesterId?: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useAcademicSettings();
  const semesters = useSemesterOptions();
  const teachers = useQuery(activeTeachersQuery);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      semester_id: defaultSemesterId ? String(defaultSemesterId) : "",
      code: "",
      name: "",
      teacher_id: "",
    },
    validators: { onSubmit: SubjectSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      if (semesters.isClosed(value.semester_id)) {
        setFormError(
          `El ${settings.period_label.toLowerCase()} está cerrado: no se le pueden añadir materias.`,
        );
        return;
      }
      let subject: SubjectRead;
      try {
        subject = await unwrap(
          api.POST("/api/v1/subjects", {
            body: {
              semester_id: Number(value.semester_id),
              code: value.code.trim(),
              name: value.name.trim(),
            },
          }),
        );
      } catch (error) {
        setFormError(applyApiErrors(form, error));
        return;
      }
      if (value.teacher_id) {
        try {
          await addSubjectToTeacher(queryClient, Number(value.teacher_id), subject.id);
        } catch (error) {
          toast.error(
            `La materia se creó, pero no se pudo asignar el profesor: ${(error as Error).message}`,
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
      toast.success(`Materia ${subject.code} creada.`);
      await navigate({ to: "/admin/academic", search: { semester: subject.semester.id } });
    },
  });

  return (
    <form
      noValidate
      className="card card-border w-full max-w-xl bg-base-100"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="card-body gap-2">
        <FormError message={formError} />
        <form.AppField name="semester_id">
          {(field) => (
            <field.SelectField
              label={settings.period_label}
              options={semesters.options}
              hint={`Los ${settings.period_label_plural.toLowerCase()} cerrados no admiten materias nuevas.`}
            />
          )}
        </form.AppField>
        <div className="grid gap-x-3 sm:grid-cols-[10rem_1fr]">
          <form.AppField name="code">
            {(field) => <field.TextField label="Código" placeholder="Ej. MAT-101" />}
          </form.AppField>
          <form.AppField name="name">
            {(field) => <field.TextField label="Nombre" placeholder="Ej. Matemática I" />}
          </form.AppField>
        </div>
        <form.AppField name="teacher_id">
          {(field) => (
            <field.SelectField
              label="Profesor (opcional)"
              hint="Puedes asignarlo después desde el detalle de la materia."
              options={[
                { value: "", label: "Selecciona un profesor…" },
                ...(teachers.data?.items ?? []).map((t) => ({
                  value: String(t.id),
                  label: t.full_name,
                })),
              ]}
            />
          )}
        </form.AppField>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to="/admin/academic"
            search={defaultSemesterId ? { semester: defaultSemesterId } : {}}
            className="btn btn-outline btn-primary"
          >
            Cancelar
          </Link>
          <form.AppForm>
            <form.SubmitButton label="Crear materia" />
          </form.AppForm>
        </div>
      </div>
    </form>
  );
}

/** Edición de materia (periodo, código y nombre) */
export function EditSubjectModal({
  subject,
  onClose,
}: {
  subject: SubjectRead;
  onClose: () => void;
}) {
  const settings = useAcademicSettings();
  const queryClient = useQueryClient();
  const semesters = useSemesterOptions();
  const closed = subject.semester.is_closed;
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      semester_id: String(subject.semester.id),
      code: subject.code,
      name: subject.name,
      teacher_id: "",
    },
    validators: { onSubmit: SubjectSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await unwrap(
          api.PATCH("/api/v1/subjects/{subject_id}", {
            params: { path: { subject_id: subject.id } },
            body: {
              semester_id: Number(value.semester_id),
              code: value.code.trim(),
              name: value.name.trim(),
            },
          }),
        );
        await queryClient.invalidateQueries({ queryKey: adminKeys.subjects });
        toast.success("Materia actualizada.");
        onClose();
      } catch (error) {
        setFormError(applyApiErrors(form, error));
      }
    },
  });

  return (
    <Modal open title="Editar materia" onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FormError message={formError} />
        <form.AppField name="semester_id">
          {(field) => (
            <field.SelectField
              label={settings.period_label}
              options={semesters.options}
              disabled={closed}
              hint={
                closed
                  ? `El ${settings.period_label.toLowerCase()} está cerrado: la materia no se puede mover.`
                  : `No se puede mover a un ${settings.period_label.toLowerCase()} cerrado.`
              }
            />
          )}
        </form.AppField>
        <form.AppField name="code">{(field) => <field.TextField label="Código" />}</form.AppField>
        <form.AppField name="name">{(field) => <field.TextField label="Nombre" />}</form.AppField>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <form.AppForm>
            <form.SubmitButton label="Guardar" />
          </form.AppForm>
        </div>
      </form>
    </Modal>
  );
}
