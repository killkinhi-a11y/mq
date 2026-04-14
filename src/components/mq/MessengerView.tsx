"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import { mockContacts } from "@/lib/mockData";
import MessageBubble from "./MessageBubble";
import { Input } from "@/components/ui/input";
import {
  Lock, Shield, Send, ArrowLeft, Search, ShieldCheck, Phone
} from "lucide-react";
import { simulateEncrypt, getEncryptionStatus, generateMockFingerprint } from "@/lib/crypto";

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  encrypted: boolean;
  createdAt: string;
  senderName?: string;
}

export default function MessengerView() {
  const { userId, messages, addMessage, selectedContactId, setSelectedContact, animationsEnabled } = useAppStore();
  const [inputText, setInputText] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [fingerprint] = useState(generateMockFingerprint);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedContact = mockContacts.find((c) => c.id === selectedContactId);

  const filteredContacts = mockContacts.filter((c) =>
    c.name.toLowerCase().includes(searchContact.toLowerCase())
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContactId]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedContactId || !userId) return;

    const encryptedContent = await simulateEncrypt(inputText.trim());
    const msg: ChatMessage = {
      id: Date.now().toString(),
      content: encryptedContent,
      senderId: userId,
      receiverId: selectedContactId,
      encrypted: true,
      createdAt: new Date().toISOString(),
      senderName: "Вы",
    };

    addMessage(msg as any);
    setInputText("");

    // Simulate response
    setTimeout(() => {
      const responses = [
        "Привет! Как дела? 🔒",
        "Отлично! Что слушаешь?",
        "Отправь мне трек! 🎵",
        "Круто, давай потом обсудим",
        "Привет! Шифрование работает 🛡️",
      ];
      const reply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        senderId: selectedContactId,
        receiverId: userId,
        encrypted: true,
        createdAt: new Date().toISOString(),
        senderName: selectedContact?.name,
      };
      addMessage(reply as any);
    }, 1500 + Math.random() * 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contactMessages = messages.filter(
    (m) =>
      (selectedContactId && m.senderId === selectedContactId) ||
      (userId && m.receiverId === selectedContactId)
  );

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ backgroundColor: "var(--mq-bg)" }}
    >
      {/* Contacts sidebar */}
      <div
        className={`w-full lg:w-80 flex-shrink-0 ${selectedContactId ? "hidden lg:flex" : "flex"} flex-col lg:h-screen`}
        style={{
          borderRight: "1px solid var(--mq-border)",
        }}
      >
        {/* Header */}
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--mq-border)" }}
        >
          <h2 className="font-bold" style={{ color: "var(--mq-text)" }}>
            Мессенджер
          </h2>
          <div className="flex items-center gap-1" title="Сквозное шифрование">
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--mq-accent)" }} />
            <span className="text-[10px]" style={{ color: "var(--mq-accent)" }}>
              E2E
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
            <Input
              placeholder="Поиск контактов..."
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              className="pl-10 min-h-[40px]"
              style={{
                backgroundColor: "var(--mq-input-bg)",
                border: "1px solid var(--mq-border)",
                color: "var(--mq-text)",
              }}
            />
          </div>
        </div>

        {/* Encryption info */}
        <div
          className="mx-3 mb-2 p-2 rounded-lg text-xs flex items-start gap-2"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
        >
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--mq-accent)" }} />
          <div>
            <p style={{ color: "var(--mq-text-muted)" }}>
              Все сообщения защищены сквозным шифрованием {getEncryptionStatus()}
            </p>
          </div>
        </div>

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto max-h-96 lg:max-h-none">
          {filteredContacts.map((contact, i) => (
            <motion.button
              key={contact.id}
              initial={animationsEnabled ? { opacity: 0, x: -10 } : undefined}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedContact(contact.id)}
              className="w-full flex items-center gap-3 p-3 hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: selectedContactId === contact.id ? "var(--mq-accent)" : "transparent",
                borderBottom: "1px solid var(--mq-border)",
              }}
            >
              <div className="relative">
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                {contact.online && (
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                    style={{
                      backgroundColor: "#4ade80",
                      borderColor: selectedContactId === contact.id ? "var(--mq-accent)" : "var(--mq-bg)",
                    }}
                  />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: selectedContactId === contact.id ? "var(--mq-text)" : "var(--mq-text)" }}
                >
                  {contact.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
                  {contact.online ? "В сети" : contact.lastSeen}
                </p>
              </div>
              <Lock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mq-accent)", opacity: 0.5 }} />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={`flex-1 flex flex-col lg:h-screen ${!selectedContactId ? "hidden lg:flex" : "flex"}`}
      >
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div
              className="flex items-center gap-3 p-3 lg:p-4"
              style={{ borderBottom: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}
            >
              <button
                onClick={() => setSelectedContact(null)}
                className="lg:hidden p-1"
                style={{ color: "var(--mq-text-muted)" }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative">
                <img
                  src={selectedContact.avatar}
                  alt={selectedContact.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                {selectedContact.online && (
                  <div
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{ backgroundColor: "#4ade80", borderColor: "var(--mq-player-bg)" }}
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--mq-text)" }}>
                  {selectedContact.name}
                </p>
                <div className="flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" style={{ color: "var(--mq-accent)" }} />
                  <span className="text-[10px]" style={{ color: "var(--mq-text-muted)" }}>
                    Зашифрованный чат
                  </span>
                </div>
              </div>
              <button
                className="p-2"
                style={{ color: "var(--mq-text-muted)" }}
                title="Видеозвонок"
              >
                <Phone className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {/* Encryption notice */}
              <div className="flex justify-center mb-4">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
                >
                  <Shield className="w-3 h-3" style={{ color: "var(--mq-accent)" }} />
                  <span style={{ color: "var(--mq-text-muted)" }}>
                    Сообщения зашифрованы • {getEncryptionStatus()}
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {contactMessages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                  >
                    <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                      Начните зашифрованный разговор с {selectedContact.name}
                    </p>
                  </motion.div>
                )}
                {contactMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg as any}
                    currentUserId={userId || undefined}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Input */}
            <div
              className="p-3 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}
            >
              <div className="flex-1 relative">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Написать сообщение..."
                  className="pr-10 min-h-[44px] rounded-full"
                  style={{
                    backgroundColor: "var(--mq-input-bg)",
                    border: "1px solid var(--mq-border)",
                    color: "var(--mq-text)",
                  }}
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--mq-accent)", opacity: 0.5 }} />
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: inputText.trim() ? "var(--mq-accent)" : "var(--mq-card)",
                  border: "1px solid var(--mq-border)",
                }}
              >
                <Send className="w-4 h-4" style={{ color: "var(--mq-text)", marginLeft: 1 }} />
              </motion.button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: "var(--mq-text)" }}>
                Безопасный мессенджер
              </h3>
              <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                Выберите контакт для начала разговора
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--mq-accent)" }}>
                Отпечаток ключа: {fingerprint}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
