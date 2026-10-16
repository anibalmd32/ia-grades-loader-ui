import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Mis materias";
const description = "Materias que tienes asignadas este período.";

export const Route = createFileRoute("/_app/teacher/subjects")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
