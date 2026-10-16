import { useQuery } from "@tanstack/react-query";
import { healthQuery } from "@/api/queries/health";
import { API_URL } from "@/lib/config";

// Aviso global cuando la API no responde (GET /health)
export function ApiStatus() {
  const { isError, isFetching, refetch } = useQuery(healthQuery);
  if (!isError) return null;

  return (
    <div role="alert" className="alert alert-error m-4">
      <span>
        No se puede conectar con la API en <code>{API_URL}</code>. Comprueba que está levantada.
      </span>
      <button type="button" className="btn btn-sm" disabled={isFetching} onClick={() => refetch()}>
        Reintentar
      </button>
    </div>
  );
}
