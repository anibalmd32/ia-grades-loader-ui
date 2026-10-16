import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { routeTree } from "@/routeTree.gen";
import type { User } from "@/stores/session";
import { useSession } from "@/stores/session";

/** Monta la app completa (router real) en la ruta indicada */
export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    role: "coordinator",
    full_name: "Carmen Rojas",
    email: "carmen@uni.edu",
    nationality: null,
    cedula: null,
    cedula_display: null,
    is_active: true,
    must_change_password: false,
    telegram_linked: false,
    ...overrides,
  };
}

/** Deja una sesión iniciada sin pasar por el login */
export function signedInAs(user: User) {
  useSession.setState({ token: "tok", user, status: "authenticated", expired: false });
}

export function signedOut() {
  useSession.setState({ token: null, user: null, status: "anonymous", expired: false });
}
