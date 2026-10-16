import { createFileRoute } from "@tanstack/react-router";
import { NewAccountPage } from "@/components/admin/account-pages";
import { StaffCreateForm } from "@/components/admin/accounts";

export const Route = createFileRoute("/_app/admin/coordinators/new")({
  staticData: { title: "Nuevo coordinador" },
  component: () => (
    <NewAccountPage kind="coordinators">
      <StaffCreateForm kind="coordinators" />
    </NewAccountPage>
  ),
});
