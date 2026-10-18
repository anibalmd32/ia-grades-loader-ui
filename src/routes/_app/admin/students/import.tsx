import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/admin/common";
import { StudentImport } from "@/components/admin/student-import";
import { PageBody, PageHeader } from "@/components/ui/page-header";

const title = "Importar estudiantes";
const description = "Alta masiva desde Excel: revisa el archivo y luego crea las cuentas.";

export const Route = createFileRoute("/_app/admin/students/import")({
  staticData: { title, description: "Alta masiva desde Excel" },
  component: StudentImportPage,
});

function StudentImportPage() {
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <BackLink to="/admin/students" label="Estudiantes" />
        <StudentImport />
      </PageBody>
    </>
  );
}
