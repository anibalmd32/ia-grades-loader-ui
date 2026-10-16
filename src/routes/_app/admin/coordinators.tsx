import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ui/coming-soon";
import { requireRole } from "@/lib/guards";

const title = "Coordinadores";
const description = "Crea y gestiona las cuentas de coordinación.";

export const Route = createFileRoute("/_app/admin/coordinators")({
  beforeLoad: ({ context }) => requireRole(context.user, ["super_admin"]),
  staticData: { title, description },
  component: () => <ComingSoon title={title} description={description} />,
});
