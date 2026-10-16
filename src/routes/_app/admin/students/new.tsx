import { createFileRoute } from "@tanstack/react-router";
import { NewAccountPage } from "@/components/admin/account-pages";
import { StudentCreateForm } from "@/components/admin/student-create-form";

export const Route = createFileRoute("/_app/admin/students/new")({
  staticData: { title: "Nuevo estudiante" },
  component: () => (
    <NewAccountPage kind="students">
      <StudentCreateForm />
    </NewAccountPage>
  ),
});
