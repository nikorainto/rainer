"use client";

import { X } from "lucide-react";
import type { ActiveAlert } from "@/hooks/useNowcastMonitor";

export function AlertBanner({ alert, onDismiss }: { alert: ActiveAlert; onDismiss: () => void }) {
  const immediate = alert.type === "immediate";
  return (
    <div
      className={`alert-pop flex items-start gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur-sm ${
        immediate ? "border-storm/40 bg-storm/20 text-ink" : "border-dry/30 bg-dry/15 text-ink"
      }`}
      role="alert"
    >
      <p className="min-w-0 flex-1 text-sm font-medium leading-5">{alert.message}</p>
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-ink"
        onClick={onDismiss}
        aria-label="Dismiss alert"
      >
        <X size={18} />
      </button>
    </div>
  );
}
