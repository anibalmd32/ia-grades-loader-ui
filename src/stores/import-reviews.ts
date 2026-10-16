import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage } from "@/lib/app-storage";

export type ImportReview = "confirmed" | "discarded";

type ImportReviewsState = {
  /** Importaciones ya revisadas en este dispositivo (la API no guarda si se confirmaron) */
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
