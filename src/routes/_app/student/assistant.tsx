import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Asistente IA";
const description = "Pregúntale por tus notas.";

export const Route = createFileRoute("/_app/student/assistant")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
