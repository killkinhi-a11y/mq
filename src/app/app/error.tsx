"use client";

import { useEffect, useCallback } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorMsg = error?.message || "";

  useEffect(() => {
    console.error("[MQ Error]", errorMsg);

    // Auto-detect stale-data errors and force-clear everything + reload
    const stalePatterns = [
      "is not defined",
      "is not a function",
      "Cannot read propert",
      "hydration",
      "localStorage",
    ];
    const isStaleError = stalePatterns.some((p) => errorMsg.includes(p));

    if (isStaleError) {
      console.warn("[MQ Error] Detected stale-data error, auto-clearing...");
      // Clear all mq-related storage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.includes("mq") || k.includes("MQ") || k.includes("zustand"))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      try { sessionStorage.clear(); } catch {}
      // Unregister service workers
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      }
      // Clear Cache API
      if (window.caches) {
        window.caches.keys().then((ks) => {
          Promise.all(ks.map((k) => window.caches.delete(k))).then(() => {
            // Force reload with cache-bust after clearing caches
            const bust = Date.now();
            window.location.replace("/app?_r=" + bust);
          });
        });
        return;
      }
      // No Cache API — reload directly
      window.location.replace("/app?_r=" + Date.now());
    }
  }, [errorMsg]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  const handleFullReset = useCallback(() => {
    // Clear all mq-related storage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes("mq") || k.includes("MQ") || k.includes("zustand"))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.replace("/app?_r=" + Date.now());
  }, []);

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
          Произошла ошибка при загрузке. Если ошибка не исчезает — откройте в
          приватном окне (Ctrl+Shift+N) или очистите кэш браузера.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleReset}
            className="w-full p-3 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: "var(--mq-accent, #e03131)",
              color: "var(--mq-text, #f5f5f5)",
            }}
          >
            Перезагрузить
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
            Сбросить данные и перезагрузить
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
