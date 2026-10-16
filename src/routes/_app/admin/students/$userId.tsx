import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { AccountDetailPage } from "@/components/admin/account-pages";
import { StudentEnrollments } from "@/components/admin/student-enrollments";

export const Route = createFileRoute("/_app/admin/students/$userId")({
  params: {
    parse: ({ userId }) => ({
      userId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), userId),
    }),
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
  staticData: { title: "Estudiante" },
  component: DetailPage,
});

function DetailPage() {
  const { userId } = Route.useParams();
  return (
    <AccountDetailPage kind="students" userId={userId}>
      {(user) => <StudentEnrollments studentId={user.id} name={user.full_name} />}
    </AccountDetailPage>
  );
}
