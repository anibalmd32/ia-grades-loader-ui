import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Mis notas";
const description = "Tus notas por lapso en cada materia.";

export const Route = createFileRoute("/_app/student/grades")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
