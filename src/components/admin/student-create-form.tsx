import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useId, useState } from "react";
import * as v from "valibot";
import {
  adminKeys,
  allSubjectsQuery,
  assignSectionStudents,
  createStudent,
  enrollStudentInSubjects,
  groupBySemester,
  type SemesterRead,
  type SubjectRead,
  semesterSectionsQuery,
  subjectLabel,
} from "@/api/queries/admin";
import { useAcademicSettings } from "@/api/queries/settings";
import { applyApiErrors } from "@/components/form/api-errors";
import {
  cedulaSchema,
  DocumentRow,
  nationalitySchema,
  useDocumentFields,
  useValidDocumentType,
} from "@/components/form/document-fields";
import { FormError, useAppForm } from "@/components/form/form";
import {
  FIRST_NAME_FIELD,
  firstNameSchema,
  LAST_NAME_FIELD,
  lastNameSchema,
  PersonNameRow,
} from "@/components/form/person-name";
import { toast } from "@/components/ui/toast";
import { GeneratedPasswordNotice } from "./accounts";
import { showGeneratedPassword } from "./generated-password";

const StudentSchema = v.object({
  first_name: firstNameSchema,
  last_name: lastNameSchema,
  nationality: nationalitySchema,
  cedula: cedulaSchema,
});

/** Alta de estudiante (nombre, tipo y número de documento) con matrícula opcional en materias */
export function StudentCreateForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subjects = useQuery(allSubjectsQuery);
  const settings = useAcademicSettings();
  const documentFields = useDocumentFields();
  const [subjectIds, setSubjectIds] = useState<Set<number>>(new Set());
  // Sección elegida en cada periodo de las materias marcadas (hace falta para matricular)
  const [sectionBySemester, setSectionBySemester] = useState<Record<number, number>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const form = useAppForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      nationality: documentFields.codes[0] ?? "",
      cedula: "",
    },
    validators: { onSubmit: StudentSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const semesters = chosenSemesters(subjects.data?.items ?? [], subjectIds);
      const missing = semesters.find((s) => !sectionBySemester[s.id]);
      if (missing) {
        setFormError(
          `Elige la sección del ${settings.period_label.toLowerCase()} ${missing.name} para matricularlo.`,
        );
        return;
      }
      let created: Awaited<ReturnType<typeof createStudent>>;
      try {
        created = await createStudent({
          first_name: value.first_name.trim(),
          last_name: value.last_name.trim(),
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
          for (const semester of semesters) {
            await assignSectionStudents(sectionBySemester[semester.id] as number, [user.id]);
          }
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
        account: `${user.full_name} · ${settings.document_label} ${user.cedula_display}`,
        password: generated_password,
      });
      await navigate({ to: "/admin/students" });
    },
  });
  const nationality = useStore(form.store, (state) => state.values.nationality);
  useValidDocumentType(nationality, documentFields.codes, (code) =>
    form.setFieldValue("nationality", code),
  );

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
        <PersonNameRow
          firstName={
            <form.AppField name="first_name">
              {(field) => <field.TextField {...FIRST_NAME_FIELD} placeholder="Ej. María" />}
            </form.AppField>
          }
          lastName={
            <form.AppField name="last_name">
              {(field) => <field.TextField {...LAST_NAME_FIELD} placeholder="Ej. Pérez" />}
            </form.AppField>
          }
        />
        <DocumentRow
          nationality={
            <form.AppField name="nationality">
              {(field) => <field.SelectField {...documentFields.nationality} />}
            </form.AppField>
          }
          cedula={
            <form.AppField name="cedula">
              {(field) => <field.TextField {...documentFields.cedula} />}
            </form.AppField>
          }
        />

        {subjects.data && subjects.data.items.length > 0 && (
          <SubjectPicker
            subjects={subjects.data.items}
            selected={subjectIds}
            onToggle={toggle}
            periodLabel={settings.period_label}
          />
        )}
        {chosenSemesters(subjects.data?.items ?? [], subjectIds).map((semester) => (
          <SectionChoice
            key={semester.id}
            semester={semester}
            periodLabel={settings.period_label}
            value={sectionBySemester[semester.id]}
            onChange={(id) => setSectionBySemester((prev) => ({ ...prev, [semester.id]: id }))}
          />
        ))}

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

/** Periodos de las materias marcadas, en el orden de la lista */
function chosenSemesters(subjects: SubjectRead[], selected: Set<number>): SemesterRead[] {
  return groupBySemester(subjects.filter((s) => selected.has(s.id))).map((g) => g.semester);
}

/** Sección del estudiante en un periodo de sus materias: sin ella no se le puede matricular */
function SectionChoice({
  semester,
  periodLabel,
  value,
  onChange,
}: {
  semester: SemesterRead;
  periodLabel: string;
  value: number | undefined;
  onChange: (sectionId: number) => void;
}) {
  const sections = useQuery(semesterSectionsQuery(semester.id));
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold text-sm">
        Sección en {periodLabel.toLowerCase()} {semester.name}
      </label>
      {sections.data && sections.data.length === 0 ? (
        <p className="text-sm text-warning">
          Este {periodLabel.toLowerCase()} no tiene secciones: créalas antes de matricular.
        </p>
      ) : (
        <select
          id={id}
          className="select w-full sm:max-w-xs"
          value={value ?? ""}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="" disabled>
            Selecciona una sección…
          </option>
          {sections.data?.map((section) => (
            <option key={section.id} value={section.id}>
              Sección {section.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * Materias a matricular: un selector de periodo con sus materias y, debajo, el resumen de
 * todas las marcadas (de cualquier periodo), que se mantiene aunque se cambie de periodo.
 */
function SubjectPicker({
  subjects,
  selected,
  onToggle,
  periodLabel,
}: {
  subjects: SubjectRead[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  periodLabel: string;
}) {
  const groups = groupBySemester(subjects);
  // Por defecto el primer periodo abierto (los cerrados no admiten matrículas)
  const firstOpen = groups.find((g) => !g.semester.is_closed) ?? groups[0];
  const [semesterId, setSemesterId] = useState(firstOpen?.semester.id);
  const current = groups.find((g) => g.semester.id === semesterId) ?? firstOpen;
  const chosen = subjects.filter((s) => selected.has(s.id));
  const selectId = useId();
  if (!current) return null;

  const countIn = (id: number) => chosen.filter((s) => s.semester.id === id).length;

  return (
    <fieldset className="mt-2 flex flex-col gap-3">
      <legend className="mb-2 font-semibold text-sm">Matricular en materias (opcional)</legend>
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-base-content/70 text-sm">
          {periodLabel}
        </label>
        <select
          id={selectId}
          className="select w-full sm:max-w-xs"
          value={current.semester.id}
          onChange={(event) => setSemesterId(Number(event.target.value))}
        >
          {groups.map(({ semester }) => {
            const count = countIn(semester.id);
            return (
              <option key={semester.id} value={semester.id}>
                {semester.name}
                {semester.is_closed ? " (cerrado)" : ""}
                {count > 0 ? ` · ${count} ${count === 1 ? "elegida" : "elegidas"}` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {current.semester.is_closed && (
          <p className="text-base-content/60 text-xs">
            {periodLabel} cerrado: no admite matrículas.
          </p>
        )}
        {current.subjects.map((subject) => (
          <label
            key={subject.id}
            className={`flex items-center gap-3 ${current.semester.is_closed ? "opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              className="checkbox checkbox-primary checkbox-sm"
              disabled={current.semester.is_closed}
              checked={selected.has(subject.id)}
              onChange={() => onToggle(subject.id)}
            />
            <span>{subjectLabel(subject)}</span>
          </label>
        ))}
      </div>

      <section
        className="rounded-box border border-base-300 bg-base-200/50 p-3"
        aria-label="Materias seleccionadas"
      >
        <p className="font-semibold text-sm">
          Materias seleccionadas{chosen.length > 0 ? ` (${chosen.length})` : ""}
        </p>
        {chosen.length === 0 ? (
          <p className="text-base-content/60 text-sm">Aún no has elegido ninguna materia.</p>
        ) : (
          <ul className="mt-1 flex flex-col divide-y divide-base-300">
            {chosen.map((subject) => (
              <li key={subject.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm">{subjectLabel(subject)}</span>
                  <span className="block text-base-content/60 text-xs">
                    {periodLabel} {subject.semester.name}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square"
                  aria-label={`Quitar ${subjectLabel(subject)}`}
                  onClick={() => onToggle(subject.id)}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </fieldset>
  );
}
