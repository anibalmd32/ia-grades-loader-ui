import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MissingApiConfig } from "@/components/missing-api-config";
import { registerAndroidBackButton } from "@/lib/android-back";
import { API_CONFIGURED } from "@/lib/config";
import { disableContextMenu } from "@/lib/context-menu";
import { queryClient } from "@/lib/query-client";
// Registra el token en el cliente de la API y restaura la sesión guardada
import "@/stores/session";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // TanStack Query maneja la caché; el router siempre pide datos frescos al loader
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

registerAndroidBackButton();
disableContextMenu();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {API_CONFIGURED ? (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ) : (
      <MissingApiConfig />
    )}
  </StrictMode>,
);
