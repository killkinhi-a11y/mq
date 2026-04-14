"use client";

import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { simulateDecryptSync } from "@/lib/crypto";

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    encrypted: boolean;
    createdAt: string;
    senderName?: string;
  };
  currentUserId?: string;
}

export default function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isMine = message.senderId === currentUserId;
  const time = new Date(message.createdAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Decrypt content for display
  const displayContent = (() => {
    try {
      return simulateDecryptSync(message.content);
    } catch {
      return message.content;
    }
  })();

  // Check if content is an image URL
  const isImageUrl = /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(displayContent.trim());

  // Check if it's a shared track
  const isTrackShare = displayContent.startsWith("🎵");

  // Highlight @mentions in text
  const renderContent = () => {
    if (isImageUrl) {
      return (
        <img
          src={displayContent.trim()}
          alt="Image"
          className="rounded-lg max-w-full max-h-64 object-cover"
          loading="lazy"
        />
      );
    }

    const parts = displayContent.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} style={{ color: "var(--mq-accent)", fontWeight: 600 }}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[80%]">
        {/* Show sender name for received messages */}
        {!isMine && message.senderName && (
          <p className="text-[10px] mb-1 ml-1" style={{ color: "var(--mq-accent)" }}>
            {message.senderName}
          </p>
        )}
        <div
          className="rounded-2xl px-4 py-2.5 relative"
          style={{
            backgroundColor: isMine ? "var(--mq-accent)" : "var(--mq-card)",
            borderBottomRightRadius: isMine ? "4px" : undefined,
            borderBottomLeftRadius: isMine ? undefined : "4px",
            border: isMine ? "none" : "1px solid var(--mq-border)",
          }}
        >
          {/* Track share card */}
          {isTrackShare && (
            <div
              className="flex items-center gap-2 mb-1.5 p-2 rounded-lg"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <span style={{ fontSize: 16 }}>🎵</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--mq-text)" }}>
                  Поделился треком
                </p>
              </div>
            </div>
          )}

          <p className="text-sm break-words" style={{ color: "var(--mq-text)" }}>
            {renderContent()}
          </p>

          <div className="flex items-center justify-end gap-1 mt-1">
            {message.encrypted && (
              <div className="flex items-center gap-0.5" title="Зашифровано">
                <Lock className="w-2.5 h-2.5" style={{ color: isMine ? "var(--mq-text)" : "var(--mq-accent)", opacity: 0.7 }} />
              </div>
            )}
            <span className="text-[10px]" style={{ color: isMine ? "var(--mq-text)" : "var(--mq-text-muted)", opacity: 0.7 }}>
              {time}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
