import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification, NotificationPage } from "@/api/queries/notifications";
import { notificationKeys } from "@/api/queries/notifications";
import { API_URL } from "@/lib/config";
import { usePreferences } from "@/stores/preferences";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

const system = vi.hoisted(() => ({
  access: "default" as "granted" | "denied" | "default" | "unsupported",
  shown: [] as { title: string; body: string }[],
}));
vi.mock("@/lib/system-notifications", () => ({
  notificationAccess: async () => system.access,
  requestNotificationAccess: async () => {
    system.access = system.access === "default" ? "granted" : system.access;
    return system.access;
  },
  showSystemNotification: async (n: { title: string; body: string }) => {
    system.shown.push({ title: n.title, body: n.body });
  },
}));

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const notice = (id: number, overrides: Partial<Notification> = {}): Notification => ({
  id,
  title: "Nueva nota en Matemática I",
  body: "Lapso 1: 15",
  subject_id: 10,
  created_at: hoursAgo(id),
  read_at: null,
  ...overrides,
});

const page = (items: Notification[]): NotificationPage => ({
  items,
  total: items.length,
  limit: 20,
  offset: 0,
  unread: items.filter((n) => n.read_at == null).length,
});

let current: Notification[] = [];

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({ systemNotifications: false, lastNotified: {}, biometricLock: false });
  system.access = "default";
  system.shown = [];
  current = [
    notice(2, { body: "Parcial (Lapso 2): 18 · Lapso 2: 17.5" }),
    notice(1, { title: "Nueva nota en Física", read_at: hoursAgo(1) }),
  ];
  signedInAs(makeUser({ id: 7, role: "student", full_name: "María Pérez" }));
  server.use(
    http.get(`${API_URL}/student/notifications`, () => HttpResponse.json(page(current))),
    http.get(`${API_URL}/student/subjects`, () =>
      HttpResponse.json({ subjects: [], average: null, semesters: [] }),
    ),
  );
});

describe("avisos del estudiante", () => {
  it("lista los avisos, resalta los no leídos y cuenta los pendientes en el menú", async () => {
    renderApp("/student/notifications");

    expect(await screen.findByText("Parcial (Lapso 2): 18 · Lapso 2: 17.5")).toBeInTheDocument();
    expect(screen.getByText("1 aviso sin leer")).toBeInTheDocument();
    expect(screen.getAllByText("(sin leer)")).toHaveLength(1);
    // Menú lateral con el contador y campana del móvil
    const menuLink = screen.getAllByRole("link", { name: /Avisos/ });
    expect(menuLink.some((link) => within(link).queryByText("1"))).toBe(true);
    expect(screen.getByRole("link", { name: "Avisos: 1 sin leer" })).toBeInTheDocument();
  });

  it("al abrir un aviso lo marca como leído y va a la materia", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/student/notifications/read`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ unread: 0 });
      }),
      http.get(`${API_URL}/student/subjects/10`, () =>
        HttpResponse.json({ detail: "No encontrada" }, { status: 404 }),
      ),
    );
    const { router } = renderApp("/student/notifications");

    await user.click(await screen.findByText("Parcial (Lapso 2): 18 · Lapso 2: 17.5"));
    await waitFor(() => expect(body).toEqual({ ids: [2] }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/student/grades/10"));
  });

  it("marca todos como leídos", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/student/notifications/read`, async ({ request }) => {
        body = await request.json();
        current = current.map((n) => ({ ...n, read_at: hoursAgo(0) }));
        return HttpResponse.json({ unread: 0 });
      }),
    );
    renderApp("/student/notifications");
    // Las acciones de la cabecera se repiten en escritorio y móvil
    const [button] = await screen.findAllByRole("button", { name: "Marcar todo como leído" });
    await user.click(button as HTMLElement);
    await waitFor(() => expect(body).toEqual({}));
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Marcar todo como leído" })).toHaveLength(0),
    );
  });

  it("sin avisos lo explica", async () => {
    current = [];
    renderApp("/student/notifications");
    expect(await screen.findByText("Aún no tienes avisos")).toBeInTheDocument();
  });
});

describe("notificaciones del sistema", () => {
  it("al activarlas pide permiso y envía una de prueba", async () => {
    const user = userEvent.setup();
    renderApp("/profile");
    const toggle = await screen.findByRole("checkbox", {
      name: "Avisarme en este dispositivo cuando tenga notas nuevas",
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(usePreferences.getState().systemNotifications).toBe(true);
    expect(system.shown).toEqual([
      {
        title: "Notificaciones activadas",
        body: "Te avisaremos aquí cada vez que te carguen o corrijan una nota.",
      },
    ]);
  });

  it("si están bloqueadas explica cómo permitirlas", async () => {
    system.access = "denied";
    renderApp("/student/notifications");
    expect(await screen.findByText(/Bloqueaste las notificaciones de Notas/)).toBeInTheDocument();
  });

  it("muestra solo los avisos nuevos desde la última vez", async () => {
    system.access = "granted";
    usePreferences.setState({ systemNotifications: true });
    const { queryClient } = renderApp("/student/grades");

    // Primera consulta: los avisos que ya había no se notifican
    await waitFor(() => expect(usePreferences.getState().lastNotified[7]).toBe(2));
    expect(system.shown).toEqual([]);

    current = [notice(3, { title: "Nueva nota en Química", body: "Lapso 3: 12" }), ...current];
    await queryClient.invalidateQueries({ queryKey: notificationKeys.latest });
    await waitFor(() =>
      expect(system.shown).toEqual([{ title: "Nueva nota en Química", body: "Lapso 3: 12" }]),
    );
    expect(usePreferences.getState().lastNotified[7]).toBe(3);

    // Muchos de golpe: una sola notificación que los resume
    current = [4, 5, 6, 7].map((id) => notice(id)).concat(current);
    await queryClient.invalidateQueries({ queryKey: notificationKeys.latest });
    await waitFor(() => expect(system.shown).toHaveLength(2));
    expect(system.shown[1]).toEqual({
      title: "Tienes notas nuevas",
      body: "4 avisos nuevos de tus materias. Ábrelos en Notas.",
    });
  });

  it("sin activarlas no muestra notificaciones del sistema", async () => {
    system.access = "granted";
    usePreferences.setState({ lastNotified: { 7: 1 } });
    renderApp("/student/grades");
    await waitFor(() => expect(usePreferences.getState().lastNotified[7]).toBe(2));
    expect(system.shown).toEqual([]);
  });
});
