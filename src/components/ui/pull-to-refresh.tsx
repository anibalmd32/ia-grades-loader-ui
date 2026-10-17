import { RefreshCw } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

const THRESHOLD = 70;

/**
 * "Desliza hacia abajo para actualizar" en pantallas táctiles: si la página está arriba del
 * todo y se arrastra más de THRESHOLD px, llama a onRefresh.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
}) {
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const end = async () => {
    const reached = pull >= THRESHOLD;
    start.current = null;
    setPull(0);
    if (!reached || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      onTouchStart={(event) => {
        start.current = window.scrollY <= 0 ? (event.touches[0]?.clientY ?? null) : null;
      }}
      onTouchMove={(event) => {
        if (start.current == null) return;
        const delta = (event.touches[0]?.clientY ?? 0) - start.current;
        setPull(Math.max(0, Math.min(delta, THRESHOLD * 1.5)));
      }}
      onTouchEnd={() => void end()}
    >
      {(pull > 0 || refreshing) && (
        <div
          className="flex justify-center text-primary lg:hidden"
          style={{ height: refreshing ? THRESHOLD / 2 : pull / 2 }}
          aria-live="polite"
        >
          <RefreshCw
            className={`size-5 self-end ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
            aria-label={refreshing ? "Actualizando" : undefined}
          />
        </div>
      )}
      {children}
    </div>
  );
}
