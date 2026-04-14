"use client";

import { useEffect, useCallback } from "react";

// Known stale-state errors from old builds
const STALE_ERRORS = [
  "is not defined",
  "is not a function",
  "Cannot read",
  "Cannot destructure",
  "hydrat",
];

function isStaleError(msg: string): boolean {
  return STALE_ERRORS.some((p) => msg.includes(p));
}

async function clearAllBrowserData() {
  // 1. Clear localStorage
  try { localStorage.clear(); } catch {}
  // 2. Clear sessionStorage
  try { sessionStorage.clear(); } catch {}
  // 3. Clear all Cache API caches (Service Workers, etc.)
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
  }
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorMsg = error?.message || "";

  // On mount, if this looks like a stale-data error, auto-clear and reload
  useEffect(() => {
    console.error("[MQ Error]", errorMsg);
    if (isStaleError(errorMsg)) {
      clearAllBrowserData().then(() => {
        // Navigate to root with cache-bust to force fresh HTML + chunks
        const bust = Date.now();
        window.location.replace("/?_cb=" + bust);
      });
    }
  }, [errorMsg]);

  const handleFullReset = useCallback(async () => {
    await clearAllBrowserData();
    window.location.replace("/?_cb=" + Date.now());
  }, []);

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  // For stale errors, show a "clearing data" message (auto-reload is in progress)
  if (isStaleError(errorMsg)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: "var(--mq-bg, #0e0e0e)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-6 text-center"
          style={{
            backgroundColor: "var(--mq-card, #1a1a1a)",
            border: "1px solid var(--mq-border, #333)",
          }}
        >
          <div
            className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--mq-accent, #e03131)", borderTopColor: "transparent" }}
          />
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "var(--mq-text, #f5f5f5)" }}
          >
            Очистка данных...
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--mq-text-muted, #888)" }}
          >
            Обнаружены устаревшие данные. Страница перезагрузится автоматически.
          </p>
          <button
            onClick={handleFullReset}
            className="w-full p-3 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: "var(--mq-accent, #e03131)",
              color: "var(--mq-text, #f5f5f5)",
            }}
          >
            Сбросить и перезагрузить вручную
          </button>
        </div>
      </div>
    );
  }

  // Generic error fallback
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--mq-bg, #0e0e0e)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center"
        style={{
          backgroundColor: "var(--mq-card, #1a1a1a)",
          border: "1px solid var(--mq-border, #333)",
        }}
      >
        <div
          className="text-5xl mb-4"
          style={{ color: "var(--mq-accent, #e03131)" }}
        >
          !
        </div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "var(--mq-text, #f5f5f5)" }}
        >
          Что-то пошло не так
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--mq-text-muted, #888)" }}
        >
          Произошла ошибка при загрузке приложения.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full p-3 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: "var(--mq-accent, #e03131)",
              color: "var(--mq-text, #f5f5f5)",
            }}
          >
            Попробовать снова
          </button>
          <button
            onClick={handleFullReset}
            className="w-full p-3 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--mq-border, #333)",
              color: "var(--mq-text-muted, #888)",
            }}
          >
            Сбросить все данные
          </button>
        </div>
        <p
          className="text-xs mt-4"
          style={{ color: "var(--mq-text-muted, #888)", opacity: 0.5 }}
        >
          {errorMsg || "Unknown error"}
        </p>
      </div>
    </div>
  );
}
