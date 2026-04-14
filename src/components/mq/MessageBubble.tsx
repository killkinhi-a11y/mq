"use client";

import { useAppStore } from "@/store/useAppStore";
import { motion } from "framer-motion";
import { Lock, Shield, CheckCircle2 } from "lucide-react";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div className="max-w-[80%]">
        <div
          className="rounded-2xl px-4 py-2.5 relative"
          style={{
            backgroundColor: isMine ? "var(--mq-accent)" : "var(--mq-card)",
            borderBottomRightRadius: isMine ? "4px" : undefined,
            borderBottomLeftRadius: isMine ? undefined : "4px",
            border: isMine ? "none" : "1px solid var(--mq-border)",
          }}
        >
          <p
            className="text-sm break-words"
            style={{
              color: isMine ? "var(--mq-text)" : "var(--mq-text)",
            }}
          >
            {message.content}
          </p>

          {/* Encryption badge */}
          <div className="flex items-center justify-end gap-1 mt-1">
            {message.encrypted && (
              <div className="flex items-center gap-0.5" title="Зашифровано">
                <Lock className="w-2.5 h-2.5" style={{ color: isMine ? "var(--mq-text)" : "var(--mq-accent)", opacity: 0.7 }} />
              </div>
            )}
            <span
              className="text-[10px]"
              style={{ color: isMine ? "var(--mq-text)" : "var(--mq-text-muted)", opacity: 0.7 }}
            >
              {time}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
