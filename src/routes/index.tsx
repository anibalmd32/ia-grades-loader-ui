import { createFileRoute } from "@tanstack/react-router";
import { AppVersion } from "@/components/app-version";
import { type Theme, usePreferences } from "@/stores/preferences";

export const Route = createFileRoute("/")({
  component: Home,
});

const themes: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

// Pantalla provisional: comprueba router, daisyUI y el store persistido
function Home() {
  const { theme, setTheme } = usePreferences();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Notas</h1>
      <div className="join">
        {themes.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`btn join-item ${theme === t.value ? "btn-primary" : ""}`}
            onClick={() => setTheme(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm opacity-60">
        Notas <AppVersion />
      </p>
    </main>
  );
}
