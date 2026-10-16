import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Profesores";
const description = "Crea cuentas y asígnales materias.";

export const Route = createFileRoute("/_app/admin/teachers")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
