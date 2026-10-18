import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage } from "@/lib/app-storage";

export type ImportReview = "confirmed" | "discarded";

type ImportReviewsState = {
  /** Importaciones descartadas en este dispositivo (la confirmación la registra la API: confirmed_at) */
  reviews: Record<string, ImportReview>;
  markReviewed: (jobId: string, review: ImportReview) => void;
};

// Se conservan las últimas; la API solo lista las 20 más recientes
const MAX_ENTRIES = 100;

export const useImportReviews = create<ImportReviewsState>()(
  persist(
    (set) => ({
      reviews: {},
      markReviewed: (jobId, review) =>
        set(({ reviews }) => ({
          reviews: Object.fromEntries(
            [...Object.entries(reviews).filter(([id]) => id !== jobId), [jobId, review]].slice(
              -MAX_ENTRIES,
            ),
          ),
        })),
    }),
    { name: "import-reviews", storage: createJSONStorage(() => appStorage) },
  ),
);
