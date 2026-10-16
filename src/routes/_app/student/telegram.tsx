import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";

const title = "Telegram";
const description = "Consulta tus notas desde Telegram.";

export const Route = createFileRoute("/_app/student/telegram")({
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
