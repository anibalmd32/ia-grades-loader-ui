import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { type AccountKind, type UserRead, userQuery } from "@/api/queries/admin";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  ACCOUNTS,
  AccountHeader,
  AccountsList,
  type AccountsSearch,
  NewAccountButton,
} from "./accounts";
import { BackLink } from "./common";

export function AccountsListPage(props: {
  kind: AccountKind;
  search: AccountsSearch;
  onSearchChange: (patch: Partial<AccountsSearch>) => void;
}) {
  const config = ACCOUNTS[props.kind];
  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={<NewAccountButton kind={props.kind} />}
      />
      <PageBody>
        <AccountsList {...props} />
      </PageBody>
    </>
  );
}

export function NewAccountPage({ kind, children }: { kind: AccountKind; children: ReactNode }) {
  const config = ACCOUNTS[kind];
  return (
    <>
      <PageHeader
        title={config.newLabel}
        description={`Datos de acceso del ${config.singular.toLowerCase()}.`}
      />
      <PageBody>
        <BackLink to={config.listPath} label="Volver" />
        {children}
      </PageBody>
    </>
  );
}

export function AccountDetailPage({
  kind,
  userId,
  children,
}: {
  kind: AccountKind;
  userId: number;
  children?: (user: UserRead) => ReactNode;
}) {
  const config = ACCOUNTS[kind];
  const query = useQuery(userQuery(kind, userId));
  const user = query.data;

  return (
    <>
      <PageHeader title={user?.full_name ?? config.singular} description={config.singular} />
      <PageBody>
        <BackLink to={config.listPath} label={config.title} />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !user ? (
          <LoadingState rows={3} />
        ) : (
          <>
            <AccountHeader kind={kind} user={user} />
            {children?.(user)}
          </>
        )}
      </PageBody>
    </>
  );
}
