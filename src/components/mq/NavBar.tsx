"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { Home, Search, MessageCircle, Settings, Music, LogOut, User } from "lucide-react";
import type { ViewType } from "@/store/useAppStore";

const navItems: { id: ViewType; icon: typeof Home; label: string }[] = [
  { id: "main", icon: Home, label: "Главная" },
  { id: "search", icon: Search, label: "Поиск" },
  { id: "messenger", icon: MessageCircle, label: "Мессенджер" },
  { id: "settings", icon: Settings, label: "Настройки" },
];

export default function NavBar() {
  const { currentView, setView, logout, username, avatar, setView: setViewAction } = useAppStore();

  return (
    <header
      className="hidden lg:flex fixed top-0 left-0 right-0 z-50 items-center justify-between px-6 py-3"
      style={{
        backgroundColor: "var(--mq-nav-bg)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--mq-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <Music className="w-6 h-6" style={{ color: "var(--mq-accent)" }} />
        <span className="font-bold text-lg" style={{ color: "var(--mq-text)" }}>
          MQ Player
        </span>
      </div>

      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView(item.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors duration-200"
              style={{
                backgroundColor: isActive ? "var(--mq-accent)" : "transparent",
                color: isActive ? "var(--mq-text)" : "var(--mq-text-muted)",
              }}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </motion.button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        {/* User profile button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setView("profile")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
        >
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--mq-accent)" }}>
              <User className="w-3.5 h-3.5" style={{ color: "var(--mq-text)" }} />
            </div>
          )}
          <span className="text-sm" style={{ color: "var(--mq-text)" }}>
            @{username || "User"}
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={logout}
          className="p-2 rounded-lg transition-colors"
          style={{ color: "var(--mq-text-muted)" }}
          title="Выйти"
        >
          <LogOut className="w-4 h-4" />
        </motion.button>
      </div>
    </header>
  );
}
