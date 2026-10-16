import { createFileRoute } from "@tanstack/react-router";
import { NewAccountPage } from "@/components/admin/account-pages";
import { StaffCreateForm } from "@/components/admin/accounts";

export const Route = createFileRoute("/_app/admin/teachers/new")({
  staticData: { title: "Nuevo profesor" },
  component: () => (
    <NewAccountPage kind="teachers">
      <StaffCreateForm kind="teachers" />
    </NewAccountPage>
  ),
});
