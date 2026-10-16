import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { AccountDetailPage } from "@/components/admin/account-pages";

export const Route = createFileRoute("/_app/admin/coordinators/$userId")({
  params: {
    parse: ({ userId }) => ({
      userId: v.parse(v.pipe(v.string(), v.toNumber(), v.integer()), userId),
    }),
    stringify: ({ userId }) => ({ userId: String(userId) }),
  },
  staticData: { title: "Coordinador" },
  component: DetailPage,
});

function DetailPage() {
  const { userId } = Route.useParams();
  return <AccountDetailPage kind="coordinators" userId={userId} />;
}
