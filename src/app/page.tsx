"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { themes, applyThemeToDOM } from "@/lib/themes";
import AuthView from "@/components/mq/AuthView";
import MainView from "@/components/mq/MainView";
import SearchView from "@/components/mq/SearchView";
import MessengerView from "@/components/mq/MessengerView";
import SettingsView from "@/components/mq/SettingsView";
import ProfileView from "@/components/mq/ProfileView";
import PlaylistView from "@/components/mq/PlaylistView";
import HistoryView from "@/components/mq/HistoryView";
import PlayerBar from "@/components/mq/PlayerBar";
import FullTrackView from "@/components/mq/FullTrackView";
import PiPPlayer from "@/components/mq/PiPPlayer";
import NavBar from "@/components/mq/NavBar";
import MobileNav from "@/components/mq/MobileNav";

const viewVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function Home() {
  const {
    currentView, currentTheme, customAccent, fontSize, animationsEnabled,
    isAuthenticated, setView,
  } = useAppStore();

  // Fix: if authenticated but stuck on auth view, redirect to main
  useEffect(() => {
    if (isAuthenticated && currentView === "auth") {
      setView("main");
    }
  }, [isAuthenticated, currentView, setView]);

  // Apply theme to DOM
  useEffect(() => {
    const theme = themes[currentTheme] || themes.default;
    applyThemeToDOM(theme, customAccent || undefined);
  }, [currentTheme, customAccent]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const renderView = () => {
    switch (currentView) {
      case "auth":
        return <AuthView />;
      case "main":
        return <MainView />;
      case "search":
        return <SearchView />;
      case "messenger":
        return <MessengerView />;
      case "settings":
        return <SettingsView />;
      case "profile":
        return <ProfileView />;
      case "playlists":
        return <PlaylistView />;
      case "history":
        return <HistoryView />;
      default:
        return <MainView />;
    }
  };

  const showNav = currentView !== "auth";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--mq-bg)" }}>
      {/* Desktop nav */}
      {showNav && <NavBar />}

      {/* Main content */}
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
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Player bar (not on auth view) */}
      {showNav && <PlayerBar />}

      {/* Full screen track view overlay */}
      <FullTrackView />

      {/* PiP Player */}
      <PiPPlayer />

      {/* Mobile nav */}
      {showNav && <MobileNav />}
    </div>
  );
}
