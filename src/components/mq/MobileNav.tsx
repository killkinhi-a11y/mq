"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { Home, Search, MessageCircle, Settings, User, ListMusic, Clock } from "lucide-react";
import type { ViewType } from "@/store/useAppStore";

const navItems: { id: ViewType; icon: typeof Home; label: string }[] = [
  { id: "main", icon: Home, label: "Главная" },
  { id: "search", icon: Search, label: "Поиск" },
  { id: "messenger", icon: MessageCircle, label: "Чаты" },
  { id: "history", icon: Clock, label: "История" },
  { id: "settings", icon: Settings, label: "Ещё" },
];

export default function MobileNav() {
  const { currentView, setView } = useAppStore();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{
        backgroundColor: "var(--mq-player-bg)",
        borderTop: "1px solid var(--mq-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setView(item.id)}
              className="flex flex-col items-center gap-1 px-3 py-1 min-w-[48px] min-h-[44px] cursor-pointer"
              style={{ color: isActive ? "var(--mq-accent)" : "var(--mq-text-muted)" }}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isActive && (
                  <motion.div
                    layoutId="mobileNavDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: "var(--mq-accent)" }}
                  />
                )}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
