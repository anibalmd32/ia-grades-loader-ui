import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Copy, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import {
  createTelegramLink,
  type TelegramLinkInvite,
  type TelegramStatus,
  telegramKeys,
  telegramStatusQuery,
  unlinkTelegram,
} from "@/api/queries/student";
import { confirm } from "@/components/ui/confirm";
import { toast } from "@/components/ui/toast";
import { openExternal } from "@/lib/open-url";
import { useSession } from "@/stores/session";

const POLL_MS = 3000;

/** "9:42" hasta la fecha indicada; null si ya pasó */
function useCountdown(until: string | undefined): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const seconds = Math.ceil((new Date(until).getTime() - Date.now()) / 1000);
  if (seconds <= 0) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const STEPS = (bot: string) => [
  "Pulsa «Generar enlace».",
  `Ábrelo en tu teléfono: se abrirá @${bot} en Telegram.`,
  "Pulsa «Iniciar» y listo. Pregunta como en el asistente.",
];

/** Generar el enlace de un solo uso y esperar a que el estudiante pulse Iniciar en Telegram */
function LinkCard({ status }: { status: TelegramStatus }) {
  const queryClient = useQueryClient();
  const [invite, setInvite] = useState<TelegramLinkInvite | null>(null);
  const left = useCountdown(invite?.expires_at);
  const expired = invite != null && left == null;
  const bot = status.bot_username ?? "el bot";

  // Mientras el enlace está vigente se consulta si ya quedó vinculado (TelegramSection avisa)
  useQuery({
    ...telegramStatusQuery,
    enabled: invite != null && !expired,
    refetchInterval: POLL_MS,
  });

  const generate = useMutation({
    mutationFn: createTelegramLink,
    onSuccess: (data) => setInvite(data),
    onError: (error) => toast.error(error.message),
  });

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast.success("Enlace copiado.");
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  };

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-xl">Vincula tu cuenta</h2>
          <span className="badge badge-ghost badge-sm font-semibold">No vinculada</span>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS(bot).map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-content text-sm">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {invite && !expired && (
          <div className="flex flex-col gap-4 rounded-box bg-base-200 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="font-semibold text-base-content/70 text-xs">Tu enlace de un solo uso</p>
              <p className="truncate font-bold text-primary">
                {invite.url.replace(/^https?:\/\//, "")}
              </p>
              <button
                type="button"
                className="btn btn-outline btn-primary btn-sm w-fit"
                onClick={copy}
              >
                <Copy className="size-4" />
                Copiar
              </button>
              <p className="text-warning text-xs">Caduca en {left} minutos.</p>
              <p className="flex items-center gap-2 text-base-content/70 text-xs">
                <span className="loading loading-spinner loading-xs" />
                Esperando a que pulses «Iniciar» en Telegram…
              </p>
            </div>
            <div className="hidden rounded-box bg-white p-2 sm:block">
              <QRCodeSVG value={invite.url} size={128} title="Código QR del enlace" />
            </div>
          </div>
        )}
        {expired && (
          <p role="alert" className="text-sm text-warning">
            El enlace caducó. Genera uno nuevo.
          </p>
        )}

        {invite && !expired ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openExternal(invite.url)}
            >
              <ExternalLink className="size-4" />
              Abrir en Telegram
            </button>
            <button
              type="button"
              className="btn btn-outline btn-primary"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              Generar un enlace nuevo
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={generate.isPending}
            onClick={() => {
              void queryClient.cancelQueries({ queryKey: telegramKeys.status });
              generate.mutate();
            }}
          >
            {generate.isPending && <span className="loading loading-spinner loading-sm" />}
            Generar enlace
          </button>
        )}
      </div>
    </section>
  );
}

function LinkedCard() {
  const queryClient = useQueryClient();
  const refreshUser = useSession((s) => s.refreshUser);
  const unlink = useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramKeys.status });
      void refreshUser().catch(() => {});
      toast.success("Telegram desvinculado.");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleUnlink = async () => {
    const ok = await confirm({
      title: "¿Desvincular Telegram?",
      message: "El bot dejará de responderte hasta que vuelvas a vincularlo.",
      confirmLabel: "Desvincular",
      danger: true,
    });
    if (ok) unlink.mutate();
  };

  return (
    <section className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CircleCheck className="size-6 text-success" />
          <h2 className="card-title text-xl">Cuenta vinculada</h2>
          <span className="badge badge-soft badge-success badge-sm font-semibold">Vinculada</span>
        </div>
        <p className="text-base-content/70">
          Ya puedes escribirle al bot, por ejemplo: «¿en qué materia voy peor?». Comandos: /nueva,
          /ayuda, /desvincular.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-error"
          disabled={unlink.isPending}
          onClick={handleUnlink}
        >
          Desvincular Telegram
        </button>
      </div>
    </section>
  );
}

export function TelegramSection({ status }: { status: TelegramStatus }) {
  const refreshUser = useSession((s) => s.refreshUser);
  const wasLinked = useRef(status.linked);

  // Al pulsar Iniciar en Telegram el sondeo trae linked = true
  useEffect(() => {
    if (status.linked && !wasLinked.current) {
      toast.success("¡Listo! Tu Telegram quedó vinculado.");
      void refreshUser().catch(() => {});
    }
    wasLinked.current = status.linked;
  }, [status.linked, refreshUser]);

  return (
    <div className="max-w-2xl">{status.linked ? <LinkedCard /> : <LinkCard status={status} />}</div>
  );
}
