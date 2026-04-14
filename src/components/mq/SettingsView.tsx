"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { themes } from "@/lib/themes";
import {
  Palette, Type, Sparkles, Minimize2, Volume2, RotateCcw, Check, Moon, Music, Shield, Zap
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function SettingsView() {
  const {
    currentTheme, setTheme, customAccent, setCustomAccent,
    animationsEnabled, setAnimationsEnabled, compactMode, setCompactMode,
    fontSize, setFontSize, volume, setVolume, logout, username, animationsEnabled: anim,
  } = useAppStore();

  const [accentInput, setAccentInput] = useState(customAccent || "");

  const themeList = Object.values(themes);

  const handleAccentChange = (color: string) => {
    setAccentInput(color);
    setCustomAccent(color);
  };

  const presetAccents = ["#e03131", "#8b5cf6", "#4ade80", "#f59e0b", "#ec4899", "#06b6d4", "#f97316"];

  return (
    <div className="p-4 lg:p-6 pb-32 lg:pb-28 space-y-6 max-w-2xl mx-auto">
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--mq-text)" }}>
          Настройки
        </h1>
        <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
          Персонализируйте ваш MQ Player
        </p>
      </motion.div>

      {/* Profile */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}
          >
            {username?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--mq-text)" }}>{username}</p>
            <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
              <Music className="w-3 h-3 inline mr-1" />
              MQ Player Premium
            </p>
          </div>
        </div>
      </motion.div>

      {/* Themes */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--mq-text)" }}>Тема оформления</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeList.map((theme) => (
            <motion.button
              key={theme.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTheme(theme.id)}
              className="rounded-xl p-3 text-left relative"
              style={{
                backgroundColor: theme.background,
                border: currentTheme === theme.id && !customAccent
                  ? `2px solid ${theme.accent}`
                  : "2px solid transparent",
                boxShadow: currentTheme === theme.id && !customAccent
                  ? `0 0 12px ${theme.glowColor}`
                  : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: theme.accent }}
                />
                <span className="text-sm font-medium" style={{ color: theme.text }}>
                  {theme.name}
                </span>
              </div>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.card }} />
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.accent, opacity: 0.5 }} />
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: theme.text, opacity: 0.3 }} />
              </div>
              {currentTheme === theme.id && !customAccent && (
                <Check className="absolute top-2 right-2 w-4 h-4" style={{ color: theme.accent }} />
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Accent color */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
            <h2 className="font-semibold" style={{ color: "var(--mq-text)" }}>Цвет акцента</h2>
          </div>
          {customAccent && (
            <button
              onClick={() => { setCustomAccent(null); setAccentInput(""); }}
              className="text-xs flex items-center gap-1"
              style={{ color: "var(--mq-text-muted)" }}
            >
              <RotateCcw className="w-3 h-3" />
              Сбросить
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {presetAccents.map((color) => (
            <motion.button
              key={color}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAccentChange(color)}
              className="w-8 h-8 rounded-full"
              style={{
                backgroundColor: color,
                border: customAccent === color ? "2px solid white" : "2px solid transparent",
                boxShadow: customAccent === color ? `0 0 12px ${color}` : "none",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accentInput || "#e03131"}
            onChange={(e) => handleAccentChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border-0"
          />
          <input
            type="text"
            value={accentInput}
            onChange={(e) => {
              const v = e.target.value;
              setAccentInput(v);
              if (/^#[0-9A-Fa-f]{6}$/.test(v)) setCustomAccent(v);
            }}
            placeholder="#e03131"
            className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
            style={{
              backgroundColor: "var(--mq-input-bg)",
              border: "1px solid var(--mq-border)",
              color: "var(--mq-text)",
            }}
          />
        </div>
      </motion.div>

      {/* Toggles */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl p-4 space-y-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--mq-text)" }}>Поведение</h2>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
            <div>
              <p className="text-sm" style={{ color: "var(--mq-text)" }}>Анимации</p>
              <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>Плавные переходы и эффекты</p>
            </div>
          </div>
          <Switch
            checked={animationsEnabled}
            onCheckedChange={setAnimationsEnabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Minimize2 className="w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
            <div>
              <p className="text-sm" style={{ color: "var(--mq-text)" }}>Компактный режим</p>
              <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>Уменьшить отступы и элементы</p>
            </div>
          </div>
          <Switch
            checked={compactMode}
            onCheckedChange={setCompactMode}
          />
        </div>
      </motion.div>

      {/* Font size */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--mq-text)" }}>Размер шрифта</h2>
          <span className="ml-auto text-sm font-mono" style={{ color: "var(--mq-accent)" }}>
            {fontSize}px
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--mq-text-muted)" }}>A</span>
          <input
            type="range"
            min="12"
            max="22"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
            style={{
              backgroundColor: "var(--mq-border)",
              accentColor: "var(--mq-accent)",
            }}
          />
          <span className="text-lg" style={{ color: "var(--mq-text-muted)" }}>A</span>
        </div>
      </motion.div>

      {/* Volume */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--mq-text)" }}>Громкость</h2>
          <span className="ml-auto text-sm font-mono" style={{ color: "var(--mq-accent)" }}>
            {volume}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            backgroundColor: "var(--mq-border)",
            accentColor: "var(--mq-accent)",
          }}
        />
      </motion.div>

      {/* Security info */}
      <motion.div
        initial={anim ? { opacity: 0, y: 20 } : undefined}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5" style={{ color: "var(--mq-accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--mq-text)" }}>Безопасность</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: "#4ade80" }} />
            <span className="text-sm" style={{ color: "var(--mq-text)" }}>Сквозное шифрование сообщений</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: "#4ade80" }} />
            <span className="text-sm" style={{ color: "var(--mq-text)" }}>AES-256-GCM шифрование</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" style={{ color: "#4ade80" }} />
            <span className="text-sm" style={{ color: "var(--mq-text)" }}>Локальное хранение данных</span>
          </div>
        </div>
      </motion.div>

      {/* Logout */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={logout}
        className="w-full p-3 rounded-xl text-center text-sm font-medium"
        style={{
          backgroundColor: "rgba(224,49,49,0.1)",
          color: "#ff6b6b",
          border: "1px solid rgba(224,49,49,0.2)",
        }}
      >
        Выйти из аккаунта
      </motion.button>
    </div>
  );
}
