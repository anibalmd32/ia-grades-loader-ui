import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Estudiantes";
const description = "Crea cuentas y matricúlalos en materias.";

export const Route = createFileRoute("/_app/admin/students")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
