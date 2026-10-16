import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as v from "valibot";
import {
  adminKeys,
  allSubjectsQuery,
  createStudent,
  enrollStudentInSubjects,
  groupBySemester,
  subjectLabel,
} from "@/api/queries/admin";
import { applyApiErrors } from "@/components/form/api-errors";
import { FormError, useAppForm } from "@/components/form/form";
import { toast } from "@/components/ui/toast";
import {
  CEDULA_FIELD,
  CedulaRow,
  cedulaSchema,
  GeneratedPasswordNotice,
  NATIONALITY_FIELD,
} from "./accounts";
import { showGeneratedPassword } from "./generated-password";

const StudentSchema = v.object({
  full_name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(3, "Escribe el nombre completo."),
    v.maxLength(150, "Máximo 150 caracteres."),
  ),
  nationality: v.picklist(["V", "E"]),
  cedula: cedulaSchema,
});

/** Alta de estudiante (nombre, V/E + cédula) con matrícula opcional en materias */
export function StudentCreateForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subjects = useQuery(allSubjectsQuery);
  const [subjectIds, setSubjectIds] = useState<Set<number>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const form = useAppForm({
    defaultValues: { full_name: "", nationality: "V" as "V" | "E", cedula: "" },
    validators: { onSubmit: StudentSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      let created: Awaited<ReturnType<typeof createStudent>>;
      try {
        created = await createStudent({
          full_name: value.full_name.trim(),
          nationality: value.nationality,
          cedula: Number(value.cedula.trim()),
        });
      } catch (error) {
        setFormError(applyApiErrors(form, error));
        return;
      }

      const { user, generated_password } = created;
      if (subjectIds.size > 0) {
        try {
          await enrollStudentInSubjects(user.id, [...subjectIds]);
        } catch (error) {
          toast.error(
            `El estudiante se creó, pero no se pudo matricular: ${(error as Error).message}`,
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: adminKeys.users("students") });
      showGeneratedPassword({
        message: "Estudiante creado correctamente.",
        account: `${user.full_name} · Cédula ${user.cedula_display}`,
        password: generated_password,
      });
      await navigate({ to: "/admin/students" });
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
        <form.AppField name="full_name">
          {(field) => <field.TextField label="Nombre completo" placeholder="Ej. María Pérez" />}
        </form.AppField>
        <CedulaRow
          nationality={
            <form.AppField name="nationality">
              {(field) => <field.SelectField {...NATIONALITY_FIELD} />}
            </form.AppField>
          }
          cedula={
            <form.AppField name="cedula">
              {(field) => <field.TextField {...CEDULA_FIELD} />}
            </form.AppField>
          }
        />

        {subjects.data && subjects.data.items.length > 0 && (
          <fieldset className="mt-2 flex flex-col gap-3">
            <legend className="mb-2 font-semibold text-sm">
              Matricular en materias (opcional)
            </legend>
            {groupBySemester(subjects.data.items).map(({ semester, subjects: list }) => (
              <div key={semester.id} className="flex flex-col gap-2">
                <p className="text-base-content/60 text-xs">Semestre {semester.name}</p>
                {list.map((subject) => (
                  <label key={subject.id} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={subjectIds.has(subject.id)}
                      onChange={() => toggle(subject.id)}
                    />
                    <span>{subjectLabel(subject)}</span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>
        )}

        <GeneratedPasswordNotice />
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/admin/students" className="btn btn-outline btn-primary">
            Cancelar
          </Link>
          <form.AppForm>
            <form.SubmitButton label="Crear estudiante" />
          </form.AppForm>
        </div>
      </div>
    </form>
  );
}
