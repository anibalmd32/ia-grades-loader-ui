import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Semestres y materias";
const description = "Organiza los semestres y sus materias.";

export const Route = createFileRoute("/_app/admin/academic")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
