import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { AccountDetailPage } from "@/components/admin/account-pages";
import { TeacherSubjects } from "@/components/admin/teacher-subjects";

export const Route = createFileRoute("/_app/admin/teachers/$userId")({
  params: {
    parse: ({ userId }) => ({
      userId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), userId),
    }),
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
  staticData: { title: "Profesor" },
  component: DetailPage,
});

function DetailPage() {
  const { userId } = Route.useParams();
  return (
    <AccountDetailPage kind="teachers" userId={userId}>
      {(user) => <TeacherSubjects teacherId={user.id} />}
    </AccountDetailPage>
  );
}
