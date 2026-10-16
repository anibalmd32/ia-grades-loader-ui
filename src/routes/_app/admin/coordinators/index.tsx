import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { AccountsListPage } from "@/components/admin/account-pages";
import {
  ACCOUNTS,
  ACCOUNTS_SEARCH_DEFAULTS,
  AccountsSearchSchema,
} from "@/components/admin/accounts";

export const Route = createFileRoute("/_app/admin/coordinators/")({
  validateSearch: AccountsSearchSchema,
  search: { middlewares: [stripSearchParams(ACCOUNTS_SEARCH_DEFAULTS)] },
  staticData: {
    title: ACCOUNTS.coordinators.title,
    description: ACCOUNTS.coordinators.description,
  },
  component: ListPage,
});

function ListPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AccountsListPage
      kind="coordinators"
      search={search}
      onSearchChange={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }) })}
    />
  );
}
