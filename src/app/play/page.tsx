"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

// Defer ALL heavy imports to client-side only using lazy + dynamic check
// The SSR version of this page renders ONLY a minimal splash screen.
// All components are loaded client-side after hydration.

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  return isClient;
}

// Client-only app shell - only imported when isClient is true
function AppShell() {
  // All heavy imports inside the client-only component
  const { motion, AnimatePresence } = require("framer-motion");
  const { useAppStore } = require("@/store/useAppStore");
  const { themes, applyThemeToDOM } = require("@/lib/themes");

  const AuthView = lazy(() => import("@/components/mq/AuthView"));
  const MainView = lazy(() => import("@/components/mq/MainView"));
  const SearchView = lazy(() => import("@/components/mq/SearchView"));
  const MessengerView = lazy(() => import("@/components/mq/MessengerView"));
  const SettingsView = lazy(() => import("@/components/mq/SettingsView"));
  const ProfileView = lazy(() => import("@/components/mq/ProfileView"));
  const PlaylistView = lazy(() => import("@/components/mq/PlaylistView"));
  const PublicPlaylistsView = lazy(() => import("@/components/mq/PublicPlaylistsView"));
  const HistoryView = lazy(() => import("@/components/mq/HistoryView"));
  const StoriesView = lazy(() => import("@/components/mq/StoriesView"));
  const PlayerBar = lazy(() => import("@/components/mq/PlayerBar"));
  const FullTrackView = lazy(() => import("@/components/mq/FullTrackView"));
  const PiPPlayer = lazy(() => import("@/components/mq/PiPPlayer"));
  const NavBar = lazy(() => import("@/components/mq/NavBar"));
  const MobileNav = lazy(() => import("@/components/mq/MobileNav"));

  const {
    currentView, currentTheme, customAccent, fontSize, animationsEnabled,
    isAuthenticated, setView, searchQuery, setSearchQuery,
  } = useAppStore();

  useEffect(() => {
    if (typeof window !== "undefined" && window.__mqRemoveSplash) {
      window.__mqRemoveSplash();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentView === "auth") setView("main");
  }, [isAuthenticated, currentView, setView]);

  useEffect(() => {
    const theme = themes[currentTheme];
    if (!theme) {
      useAppStore.getState().setTheme("default");
      applyThemeToDOM(themes.default, customAccent || undefined);
    } else {
      applyThemeToDOM(theme, customAccent || undefined);
    }
  }, [currentTheme, customAccent]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const prevViewRef = useRef(currentView);
  useEffect(() => {
    if (prevViewRef.current === "search" && currentView !== "search" && searchQuery) {
      setSearchQuery("");
    }
    prevViewRef.current = currentView;
  }, [currentView, searchQuery, setSearchQuery]);

  const viewVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  const renderView = () => {
    switch (currentView) {
      case "auth": return <AuthView />;
      case "main": return <MainView />;
      case "search": return <SearchView />;
      case "messenger": return <MessengerView />;
      case "settings": return <SettingsView />;
      case "profile": return <ProfileView />;
      case "playlists": return <PlaylistView />;
      case "public-playlists": return <PublicPlaylistsView />;
      case "history": return <HistoryView />;
      case "stories": return <StoriesView />;
      default: return <MainView />;
    }
  };

  const showNav = currentView !== "auth";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--mq-bg)" }}>
      <Suspense fallback={
        <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 border-b"
          style={{ backgroundColor: "var(--mq-surface, #161616)", borderColor: "var(--mq-border, #222)" }}>
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: "var(--mq-accent, #e03131)" }} />
        </nav>
      }>
        {showNav && <NavBar />}
      </Suspense>

      <main className={showNav ? "pt-16 lg:pt-14" : ""}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            variants={animationsEnabled ? viewVariants : undefined}
            initial={animationsEnabled ? "initial" : undefined}
            animate={animationsEnabled ? "animate" : undefined}
            exit={animationsEnabled ? "exit" : undefined}
            transition={{ duration: 0.2 }}
          >
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{ borderColor: "var(--mq-accent, #e03131)", borderTopColor: "transparent" }} />
              </div>
            }>
              {renderView()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <Suspense fallback={null}>{showNav && <PlayerBar />}</Suspense>
      <Suspense fallback={null}><FullTrackView /></Suspense>
      <Suspense fallback={null}><PiPPlayer /></Suspense>
      <Suspense fallback={null}>{showNav && <MobileNav />}</Suspense>
    </div>
  );
}

// Main page component - minimal SSR, full client
export default function PlayPage() {
  const isClient = useIsClient();

  // SSR: render minimal splash (no heavy deps)
  // Client: render full app
  if (!isClient) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ backgroundColor: "#0e0e0e" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "#e03131", boxShadow: "0 0 40px rgba(224,49,49,0.4)" }}
          >
            <span className="text-3xl font-black text-white">mq</span>
          </div>
        </div>
        <p className="text-sm" style={{ color: "#888" }}>Музыкальный плеер</p>
        <div className="h-0.5 w-24 rounded-full" style={{ backgroundColor: "#e03131", opacity: 0.4 }} />
      </div>
    );
  }

  return <AppShell />;
}
