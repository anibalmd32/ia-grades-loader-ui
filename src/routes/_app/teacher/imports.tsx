import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Importaciones";
const description = "Historial de notas importadas desde Excel.";

export const Route = createFileRoute("/_app/teacher/imports")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
