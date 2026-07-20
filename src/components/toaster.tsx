"use client";

import { useEffect, useState } from "react";

const TOAST_MS = 6000;
const MESSAGE = "Couldn’t save that change — please try again.";

type Toast = { id: number; message: string };

/**
 * A safety net for failed mutations. A rejected server action that isn't
 * caught inline surfaces as an unhandled promise rejection; this turns it
 * into a toast so the user knows their change didn't save. Call sites that
 * handle errors themselves never reach here.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onUnhandled() {
      const id = Date.now();
      setToasts((prev) => {
        if (prev.some((t) => t.message === MESSAGE)) return prev;
        return [...prev.slice(-2), { id, message: MESSAGE }];
      });
    }
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => window.removeEventListener("unhandledrejection", onUnhandled);
  }, []);

  // Dismiss the oldest toast on a timer.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(
      () => setToasts((prev) => prev.slice(1)),
      TOAST_MS,
    );
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="rise-in flex items-center gap-3 rounded-xl border border-red-200 bg-surface px-4 py-2.5 text-sm text-red-600 shadow-lg"
        >
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
            aria-label="Dismiss"
            className="shrink-0 rounded px-1 text-muted-fg transition hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
