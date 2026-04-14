"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import { mockContacts } from "@/lib/musicApi";
import MessageBubble from "./MessageBubble";
import { Input } from "@/components/ui/input";
import {
  Lock, Shield, Send, ArrowLeft, Search, ShieldCheck, Phone, Smile, Trash2
} from "lucide-react";
import { simulateEncrypt, getEncryptionStatus, generateMockFingerprint } from "@/lib/crypto";

const quickEmojis = ["😀", "😂", "❤️", "🎵", "🔥", "👍", "😎", "🤔", "💪", "🫡", "✨", "🥳"];

export default function MessengerView() {
  const { userId, username, messages, addMessage, selectedContactId, setSelectedContact, animationsEnabled } = useAppStore();
  const [inputText, setInputText] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [fingerprint] = useState(generateMockFingerprint);
  const [showEmojis, setShowEmojis] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [typingContactId, setTypingContactId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedContact = mockContacts.find((c) => c.id === selectedContactId);

  const filteredContacts = mockContacts.filter((c) =>
    c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
    c.username.toLowerCase().includes(searchContact.toLowerCase())
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContactId]);

  // @mention detection
  const handleInputChange = (value: string) => {
    setInputText(value);
    const lastWord = value.split(/\s/).pop() || "";
    if (lastWord.startsWith("@") && lastWord.length > 1) {
      setMentionSearch(lastWord.slice(1).toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionSearch("");
    }
  };

  const filteredMentions = mentionSearch
    ? mockContacts.filter((c) =>
        c.username.toLowerCase().includes(mentionSearch) ||
        c.name.toLowerCase().includes(mentionSearch)
      )
    : mockContacts;

  const handleMentionSelect = (contact: typeof mockContacts[0]) => {
    const words = inputText.split(/\s/);
    words[words.length - 1] = `@${contact.username} `;
    setInputText(words.join(" "));
    setShowMentions(false);
    setMentionSearch("");
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedContactId || !userId) return;

    const encryptedContent = await simulateEncrypt(inputText.trim());
    const msg = {
      id: Date.now().toString(),
      content: encryptedContent,
      senderId: userId,
      receiverId: selectedContactId,
      encrypted: true,
      createdAt: new Date().toISOString(),
      senderName: `@${username || "user"}`,
    };

    addMessage(msg);
    setInputText("");
    setShowEmojis(false);

    // Simulate typing then response
    setTypingContactId(selectedContactId);
    setTimeout(() => {
      setTypingContactId(null);
      const responses = [
        "Привет! Как дела? 🔒",
        "Отлично! Что слушаешь? 🎵",
        "Отправь мне трек! 🎶",
        "Круто, давай потом обсудим",
        "Привет! Шифрование работает 🛡️",
        "Да, согласен! 👍",
        "Хах, смешно 😂",
        "Мне нравится этот трек ❤️",
      ];
      const reply = {
        id: (Date.now() + 1).toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        senderId: selectedContactId,
        receiverId: userId,
        encrypted: true,
        createdAt: new Date().toISOString(),
        senderName: selectedContact ? `@${selectedContact.username}` : "Unknown",
      };
      addMessage(reply);
    }, 1500 + Math.random() * 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    useAppStore.setState({
      messages: useAppStore.getState().messages.filter((m) => m.id !== messageId),
    });
    setDeleteMessageId(null);
  };

  const contactMessages = messages.filter(
    (m) =>
      (userId && m.senderId === userId && m.receiverId === selectedContactId) ||
      (m.senderId === selectedContactId && userId && m.receiverId === userId)
  );

  // Detect image URLs in messages
  const isImageUrl = (text: string) => {
    return /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(text.trim());
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: "var(--mq-bg)" }}>
      {/* Contacts sidebar */}
      <div className={`w-full lg:w-80 flex-shrink-0 ${selectedContactId ? "hidden lg:flex" : "flex"} flex-col lg:h-screen`}
        style={{ borderRight: "1px solid var(--mq-border)" }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--mq-border)" }}>
          <h2 className="font-bold" style={{ color: "var(--mq-text)" }}>Мессенджер</h2>
          <div className="flex items-center gap-1" title="Сквозное шифрование">
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--mq-accent)" }} />
            <span className="text-[10px]" style={{ color: "var(--mq-accent)" }}>E2E</span>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
            <Input placeholder="Поиск контактов..." value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)} className="pl-10 min-h-[40px]"
              style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
          </div>
        </div>

        <div className="mx-3 mb-2 p-2 rounded-lg text-xs flex items-start gap-2"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--mq-accent)" }} />
          <p style={{ color: "var(--mq-text-muted)" }}>Все сообщения защищены сквозным шифрованием {getEncryptionStatus()}</p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-96 lg:max-h-none">
          {filteredContacts.map((contact, i) => (
            <motion.button key={contact.id}
              initial={animationsEnabled ? { opacity: 0, x: -10 } : undefined}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedContact(contact.id)}
              className="w-full flex items-center gap-3 p-3 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: selectedContactId === contact.id ? "var(--mq-accent)" : "transparent", borderBottom: "1px solid var(--mq-border)" }}>
              <div className="relative">
                <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
                {contact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                    style={{ backgroundColor: "#4ade80", borderColor: selectedContactId === contact.id ? "var(--mq-accent)" : "var(--mq-bg)" }} />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--mq-text)" }}>
                  {contact.name}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
                  @{contact.username} • {contact.online ? "В сети" : contact.lastSeen}
                </p>
              </div>
              <Lock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mq-accent)", opacity: 0.5 }} />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col lg:h-screen ${!selectedContactId ? "hidden lg:flex" : "flex"}`}>
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 p-3 lg:p-4"
              style={{ borderBottom: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}>
              <button onClick={() => setSelectedContact(null)} className="lg:hidden p-1" style={{ color: "var(--mq-text-muted)" }}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative">
                <img src={selectedContact.avatar} alt={selectedContact.name} className="w-9 h-9 rounded-full object-cover" />
                {selectedContact.online && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{ backgroundColor: "#4ade80", borderColor: "var(--mq-player-bg)" }} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--mq-text)" }}>
                  {selectedContact.name}
                </p>
                <div className="flex items-center gap-1">
                  {typingContactId === selectedContact.id ? (
                    <span className="text-[10px]" style={{ color: "var(--mq-accent)" }}>
                      печатает...
                    </span>
                  ) : (
                    <>
                      <Lock className="w-2.5 h-2.5" style={{ color: "var(--mq-accent)" }} />
                      <span className="text-[10px]" style={{ color: "var(--mq-text-muted)" }}>
                        @{selectedContact.username} • Зашифрованный чат
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button className="p-2" style={{ color: "var(--mq-text-muted)" }} title="Видеозвонок">
                <Phone className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
                  <Shield className="w-3 h-3" style={{ color: "var(--mq-accent)" }} />
                  <span style={{ color: "var(--mq-text-muted)" }}>Сообщения зашифрованы • {getEncryptionStatus()}</span>
                </div>
              </div>

              <AnimatePresence>
                {contactMessages.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                      Начните зашифрованный разговор с {selectedContact.name}
                    </p>
                  </motion.div>
                )}
                {contactMessages.map((msg) => (
                  <div key={msg.id} className="relative group/bubble"
                    onContextMenu={(e) => { e.preventDefault(); setDeleteMessageId(msg.id); }}>
                    <MessageBubble message={msg} currentUserId={userId || undefined} />
                    {/* Delete button on right-click */}
                    {deleteMessageId === msg.id && (
                      <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="absolute top-1 right-1 p-1 rounded-full z-10"
                        style={{ backgroundColor: "rgba(224,49,49,0.9)" }}>
                        <Trash2 className="w-3 h-3" style={{ color: "white" }} />
                      </motion.button>
                    )}
                  </div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {typingContactId === selectedContact.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--mq-card)", borderBottomLeftRadius: "4px", border: "1px solid var(--mq-border)" }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: "var(--mq-text-muted)" }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* @mention dropdown */}
            <AnimatePresence>
              {showMentions && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mx-3 mb-1 rounded-xl"
                  style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
                  {filteredMentions.slice(0, 4).map((c) => (
                    <button key={c.id} onClick={() => handleMentionSelect(c)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:opacity-80 transition-opacity text-left"
                      style={{ color: "var(--mq-text)" }}>
                      <img src={c.avatar} alt="" className="w-6 h-6 rounded-full" />
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs" style={{ color: "var(--mq-text-muted)" }}>@{c.username}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-3 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}>
              <div className="flex-1 relative">
                <Input ref={inputRef} value={inputText} onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown} placeholder="Написать сообщение..."
                  className="pr-10 min-h-[44px] rounded-full"
                  style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
                <Lock className="absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--mq-accent)", opacity: 0.5 }} />
              </div>

              {/* Emoji button */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEmojis(!showEmojis)}
                className="p-2 rounded-full" style={{ color: "var(--mq-text-muted)" }}>
                <Smile className="w-5 h-5" />
              </motion.button>

              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleSend}
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: inputText.trim() ? "var(--mq-accent)" : "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
                <Send className="w-4 h-4" style={{ color: "var(--mq-text)", marginLeft: 1 }} />
              </motion.button>
            </div>

            {/* Emoji picker */}
            <AnimatePresence>
              {showEmojis && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="p-3 flex flex-wrap gap-2 justify-center"
                  style={{ borderTop: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}>
                  {quickEmojis.map((emoji) => (
                    <motion.button key={emoji} whileTap={{ scale: 1.3 }} onClick={() => { setInputText((prev) => prev + emoji); inputRef.current?.focus(); }}
                      className="w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:opacity-80">
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: "var(--mq-text)" }}>Безопасный мессенджер</h3>
              <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Выберите контакт для начала разговора</p>
              <p className="text-xs mt-1" style={{ color: "var(--mq-accent)" }}>Отпечаток ключа: {fingerprint}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
