"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import {
  User, Camera, Edit3, Check, X, LogOut, Heart, MessageCircle, Music
} from "lucide-react";

export default function ProfileView() {
  const {
    username, email, avatar, likedTrackIds, dislikedTrackIds,
    messages, setView, logout,
  } = useAppStore();
  const safeLiked = Array.isArray(likedTrackIds) ? likedTrackIds : [];
  const safeDisliked = Array.isArray(dislikedTrackIds) ? dislikedTrackIds : [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(username || "");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return; // 2MB limit

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Resize avatar before storing
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const resized = canvas.toDataURL("image/jpeg", 0.8);
        useAppStore.setState({ avatar: resized });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = () => {
    useAppStore.setState({ username: editName });
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setEditName(username || "");
    setIsEditingName(false);
  };

  return (
    <div className="p-4 lg:p-6 pb-40 lg:pb-28 space-y-6 max-w-2xl mx-auto">
      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--mq-text)" }}>
          Профиль
        </h1>
        <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
          Настройте ваш аккаунт
        </p>
      </motion.div>

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center"
      >
        <div className="relative group">
          <div
            className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: avatar ? "transparent" : "var(--mq-accent)" }}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-14 h-14" style={{ color: "var(--mq-text)" }} />
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <Camera className="w-6 h-6" style={{ color: "white" }} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 text-sm flex items-center gap-1"
          style={{ color: "var(--mq-accent)" }}
        >
          <Camera className="w-3.5 h-3.5" />
          Сменить аватарку
        </button>
      </motion.div>

      {/* Username */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Имя пользователя</span>
          {!isEditingName && (
            <button onClick={() => { setEditName(username || ""); setIsEditingName(true); }}
              className="p-1.5 rounded-lg" style={{ color: "var(--mq-accent)" }}>
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isEditingName ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center rounded-lg px-3 py-2"
              style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)" }}>
              <span style={{ color: "var(--mq-text-muted)" }}>@</span>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") handleCancelEditName(); }}
                className="flex-1 bg-transparent outline-none text-sm ml-1"
                style={{ color: "var(--mq-text)" }}
                maxLength={20}
                autoFocus
              />
            </div>
            <button onClick={handleSaveName} className="p-2 rounded-lg" style={{ color: "#4ade80" }}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={handleCancelEditName} className="p-2 rounded-lg" style={{ color: "var(--mq-text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-lg font-semibold" style={{ color: "var(--mq-text)" }}>
            @{username || "User"}
          </p>
        )}
      </motion.div>

      {/* Email */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-4"
        style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
      >
        <span className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Email</span>
        <p className="text-sm font-medium mt-1" style={{ color: "var(--mq-text)" }}>{email || "—"}</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--mq-accent)", opacity: 0.8 }}>
            <Heart className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>{safeLiked.length}</p>
            <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>Избранных</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "var(--mq-accent)", opacity: 0.8 }}>
            <MessageCircle className="w-5 h-5" style={{ color: "var(--mq-text)" }} />
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--mq-text)" }}>{safeMessages.length}</p>
            <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>Сообщений</p>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("settings")}
          className="w-full p-3 rounded-xl text-left text-sm font-medium flex items-center gap-3"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
        >
          <Music className="w-4 h-4" style={{ color: "var(--mq-accent)" }} />
          Настройки приложения
        </motion.button>

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
          <span className="flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" />
            Выйти из аккаунта
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
