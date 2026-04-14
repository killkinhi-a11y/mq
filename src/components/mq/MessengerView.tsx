"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "./MessageBubble";
import { Input } from "@/components/ui/input";
import {
  Lock, Shield, Send, ArrowLeft, Search, ShieldCheck, Phone, Smile, Trash2,
  Plus, Music2, X, Loader2
} from "lucide-react";
import { simulateEncrypt, getEncryptionStatus, generateMockFingerprint, simulateDecrypt } from "@/lib/crypto";

interface FetchedUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

const quickEmojis = ["😀", "😂", "❤️", "🎵", "🔥", "👍", "😎", "🤔", "💪", "🫡", "✨", "🥳"];

function getDateLabel(dateStr: string): string {
  const msgDate = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

  if (msgDay.getTime() === today.getTime()) return "Сегодня";
  if (msgDay.getTime() === yesterday.getTime()) return "Вчера";
  return msgDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function MessengerView() {
  const {
    userId, username, messages, addMessage, selectedContactId, setSelectedContact,
    animationsEnabled, currentTrack, unreadCounts, addContact, contacts,
  } = useAppStore();

  const [inputText, setInputText] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [fingerprint] = useState(generateMockFingerprint);
  const [showEmojis, setShowEmojis] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch real users on mount
  const [allUsers, setAllUsers] = useState<FetchedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const excludeParam = userId ? `?excludeId=${userId}` : "";
        const res = await fetch(`/api/users/search${excludeParam}`);
        if (!res.ok) { setAllUsers([]); return; }
        const data = await res.json();
        if (!cancelled) setAllUsers(data.users || []);
      } catch {
        if (!cancelled) setAllUsers([]);
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    };
    fetchUsers();
    return () => { cancelled = true; };
  }, [userId]);

  // New chat dialog: search API with query
  const [newChatUsers, setNewChatUsers] = useState<FetchedUser[]>([]);
  const [isLoadingNewChat, setIsLoadingNewChat] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchNewChatUsers = async () => {
      setIsLoadingNewChat(true);
      try {
        const excludeParam = userId ? `&excludeId=${userId}` : "";
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(newChatSearch)}${excludeParam}`);
        if (!res.ok) { setNewChatUsers([]); return; }
        const data = await res.json();
        if (!cancelled) setNewChatUsers(data.users || []);
      } catch {
        if (!cancelled) setNewChatUsers([]);
      } finally {
        if (!cancelled) setIsLoadingNewChat(false);
      }
    };
    fetchNewChatUsers();
    return () => { cancelled = true; };
  }, [newChatSearch, userId]);

  // Convert fetched users to contact format for display
  const contactList = useMemo(() => {
    return allUsers.map((u) => ({
      id: u.id,
      name: u.username,
      username: u.username,
      avatar: `https://picsum.photos/seed/${u.username}/100/100`,
      online: false,
      lastSeen: new Date(u.createdAt).toLocaleDateString("ru-RU"),
    }));
  }, [allUsers]);

  // When opening new chat, reset search
  useEffect(() => {
    if (showNewChatDialog) {
      setNewChatSearch("");
    }
  }, [showNewChatDialog]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || contactList.find((c) => c.id === selectedContactId),
    [selectedContactId, contacts, contactList]
  );

  // Filter contacts: support @username search directly (local filter from fetched list)
  const filteredContacts = useMemo(() => {
    const q = searchContact.trim().toLowerCase();
    if (!q) return contactList;
    if (q.startsWith("@")) {
      const usernameQuery = q.slice(1);
      return contactList.filter((c) =>
        c.username.toLowerCase().includes(usernameQuery)
      );
    }
    return contactList.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  }, [searchContact, contactList]);

  // Get last message per contact
  const getLastMessage = useCallback((contactId: string) => {
    if (!userId) return null;
    const msgs = messages.filter(
      (m) =>
        (m.senderId === userId && m.receiverId === contactId) ||
        (m.senderId === contactId && m.receiverId === userId)
    );
    if (msgs.length === 0) return null;
    return msgs[msgs.length - 1];
  }, [messages, userId]);

  // Get unread count for contact
  const getUnreadCount = useCallback((contactId: string) => {
    return unreadCounts[contactId] || 0;
  }, [unreadCounts]);

  // New chat filtered users (from API)
  const newChatFilteredContacts = useMemo(() => {
    return newChatUsers.map((u) => ({
      id: u.id,
      name: u.username,
      username: u.username,
      avatar: `https://picsum.photos/seed/${u.username}/100/100`,
      online: false,
      lastSeen: new Date(u.createdAt).toLocaleDateString("ru-RU"),
    }));
  }, [newChatUsers]);

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
    ? contactList.filter((c) =>
        c.username.toLowerCase().includes(mentionSearch) ||
        c.name.toLowerCase().includes(mentionSearch)
      )
    : contactList;

  const handleMentionSelect = (contact: typeof contactList[0]) => {
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

  const shareTrack = async () => {
    if (!currentTrack || !selectedContactId || !userId) return;
    const trackText = `🎵 ${currentTrack.title} — ${currentTrack.artist}`;
    const encryptedContent = await simulateEncrypt(trackText);
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
  };

  const contactMessages = useMemo(() => {
    if (!userId) return [];
    return messages.filter(
      (m) =>
        (m.senderId === userId && m.receiverId === selectedContactId) ||
        (m.senderId === selectedContactId && userId && m.receiverId === userId)
    );
  }, [messages, userId, selectedContactId]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { label: string; messages: typeof contactMessages }[] = [];
    let currentLabel = "";

    for (const msg of contactMessages) {
      const label = getDateLabel(msg.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }

    return groups;
  }, [contactMessages]);

  // When selecting a contact from new chat, add to contacts list
  const handleSelectContact = (contact: { id: string; name: string; username: string; avatar: string; online: boolean; lastSeen: string }) => {
    addContact(contact);
    setSelectedContact(contact.id);
    setShowNewChatDialog(false);
    setNewChatSearch("");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: "var(--mq-bg)" }}>
      {/* Contacts sidebar */}
      <div
        className={`w-full lg:w-80 flex-shrink-0 ${selectedContactId ? "hidden lg:flex" : "flex"} flex-col lg:h-screen`}
        style={{ borderRight: "1px solid var(--mq-border)" }}
      >
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--mq-border)" }}>
          <h2 className="font-bold" style={{ color: "var(--mq-text)" }}>Мессенджер</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1" title="Сквозное шифрование">
              <ShieldCheck className="w-4 h-4" style={{ color: "var(--mq-accent)" }} />
              <span className="text-[10px]" style={{ color: "var(--mq-accent)" }}>E2E</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowNewChatDialog(true)}
              className="p-1.5 rounded-lg cursor-pointer"
              style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
              title="Новый чат"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
            <Input
              placeholder="Поиск или @username..."
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              className="pl-10 min-h-[40px]"
              style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
            />
          </div>
        </div>

        <div
          className="mx-3 mb-2 p-2 rounded-lg text-xs flex items-start gap-2"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
        >
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--mq-accent)" }} />
          <p style={{ color: "var(--mq-text-muted)" }}>Все сообщения защищены сквозным шифрованием {getEncryptionStatus()}</p>
        </div>

        <div className="flex-1 overflow-y-auto max-h-96 lg:max-h-none">
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--mq-text-muted)" }} />
            </div>
          ) : filteredContacts.length > 0 ? (
            filteredContacts.map((contact, i) => {
              const lastMsg = getLastMessage(contact.id);
              const unread = getUnreadCount(contact.id);
              return (
                <motion.button
                  key={contact.id}
                  initial={animationsEnabled ? { opacity: 0, x: -10 } : undefined}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedContact(contact.id)}
                  className="w-full flex items-center gap-3 p-3 hover:opacity-80 transition-opacity text-left cursor-pointer"
                  style={{
                    backgroundColor: selectedContactId === contact.id ? "var(--mq-accent)" : "transparent",
                    borderBottom: "1px solid var(--mq-border)",
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <img src={contact.avatar} alt={contact.name} className="w-11 h-11 rounded-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--mq-text)" }}>
                        {contact.name}
                      </p>
                      {lastMsg && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: "var(--mq-text-muted)" }}>
                          {new Date(lastMsg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs truncate" style={{ color: "var(--mq-text-muted)" }}>
                        {lastMsg ? (
                          <>
                            {lastMsg.senderId === userId ? "Вы: " : ""}
                            {(() => {
                              try {
                                const decrypted = simulateDecrypt(lastMsg.content);
                                return decrypted.length > 30 ? decrypted.slice(0, 30) + "..." : decrypted;
                              } catch {
                                return lastMsg.content.slice(0, 30) + "...";
                              }
                            })()}
                          </>
                        ) : (
                          `@${contact.username}`
                        )}
                      </p>
                      {unread > 0 && (
                        <span
                          className="min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center px-1 flex-shrink-0 font-bold"
                          style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}
                        >
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <Lock className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mq-accent)", opacity: 0.5 }} />
                </motion.button>
              );
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                {isLoadingUsers ? "Загрузка..." : "Нет пользователей"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col lg:h-screen ${!selectedContactId ? "hidden lg:flex" : "flex"}`}>
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div
              className="flex items-center gap-3 p-3 lg:p-4"
              style={{ borderBottom: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}
            >
              <button
                onClick={() => setSelectedContact(null)}
                className="lg:hidden p-1 cursor-pointer"
                style={{ color: "var(--mq-text-muted)" }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative">
                <img src={selectedContact.avatar} alt={selectedContact.name} className="w-9 h-9 rounded-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--mq-text)" }}>
                  {selectedContact.name}
                </p>
                <div className="flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" style={{ color: "var(--mq-accent)" }} />
                  <span className="text-[10px]" style={{ color: "var(--mq-text-muted)" }}>
                    @{selectedContact.username} • Зашифрованный чат
                  </span>
                </div>
              </div>
              {/* Share track button */}
              {currentTrack && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={shareTrack}
                  className="p-2 cursor-pointer"
                  style={{ color: "var(--mq-accent)" }}
                  title="Поделиться треком"
                >
                  <Music2 className="w-5 h-5" />
                </motion.button>
              )}
              <button className="p-2 cursor-pointer" style={{ color: "var(--mq-text-muted)" }} title="Видеозвонок">
                <Phone className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="flex justify-center mb-4">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
                >
                  <Shield className="w-3 h-3" style={{ color: "var(--mq-accent)" }} />
                  <span style={{ color: "var(--mq-text-muted)" }}>Сообщения зашифрованы • {getEncryptionStatus()}</span>
                </div>
              </div>

              <AnimatePresence>
                {groupedMessages.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                    <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                      Нет сообщений
                    </p>
                  </motion.div>
                )}

                {groupedMessages.map((group) => (
                  <div key={group.label}>
                    {/* Date separator */}
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 rounded-full text-[11px]" style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)", color: "var(--mq-text-muted)" }}>
                        {group.label}
                      </div>
                    </div>
                    {group.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="relative group/bubble"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setDeleteMessageId(msg.id);
                        }}
                      >
                        <MessageBubble message={msg} currentUserId={userId || undefined} />
                        {deleteMessageId === msg.id && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="absolute top-1 right-1 p-1 rounded-full z-10 cursor-pointer"
                            style={{ backgroundColor: "rgba(224,49,49,0.9)" }}
                          >
                            <Trash2 className="w-3 h-3" style={{ color: "white" }} />
                          </motion.button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </AnimatePresence>
            </div>

            {/* @mention dropdown */}
            <AnimatePresence>
              {showMentions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mx-3 mb-1 rounded-xl"
                  style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
                >
                  <div className="px-3 py-1.5">
                    <p className="text-[10px]" style={{ color: "var(--mq-text-muted)" }}>
                      Упомянуть пользователя
                    </p>
                  </div>
                  {filteredMentions.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleMentionSelect(c)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:opacity-80 transition-opacity text-left cursor-pointer"
                      style={{ color: "var(--mq-text)" }}
                    >
                      <img src={c.avatar} alt="" className="w-6 h-6 rounded-full" />
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs" style={{ color: "var(--mq-text-muted)" }}>@{c.username}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div
              className="p-3 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}
            >
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Написать сообщение..."
                  className="pr-10 min-h-[44px] rounded-full"
                  style={{
                    backgroundColor: "var(--mq-input-bg)",
                    border: "1px solid var(--mq-border)",
                    color: "var(--mq-text)",
                  }}
                />
                <Lock
                  className="absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3"
                  style={{ color: "var(--mq-accent)", opacity: 0.5 }}
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowEmojis(!showEmojis)}
                className="p-2 rounded-full cursor-pointer"
                style={{ color: "var(--mq-text-muted)" }}
              >
                <Smile className="w-5 h-5" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
                style={{
                  backgroundColor: inputText.trim() ? "var(--mq-accent)" : "var(--mq-card)",
                  border: "1px solid var(--mq-border)",
                }}
              >
                <Send className="w-4 h-4" style={{ color: "var(--mq-text)", marginLeft: 1 }} />
              </motion.button>
            </div>

            {/* Emoji picker */}
            <AnimatePresence>
              {showEmojis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-3 flex flex-wrap gap-2 justify-center"
                  style={{ borderTop: "1px solid var(--mq-border)", backgroundColor: "var(--mq-player-bg)" }}
                >
                  {quickEmojis.map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileTap={{ scale: 1.3 }}
                      onClick={() => {
                        setInputText((prev) => prev + emoji);
                        inputRef.current?.focus();
                      }}
                      className="w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:opacity-80 cursor-pointer"
                    >
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

      {/* New Chat Dialog */}
      <AnimatePresence>
        {showNewChatDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={() => setShowNewChatDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "var(--mq-card)",
                border: "1px solid var(--mq-border)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between p-4"
                style={{ borderBottom: "1px solid var(--mq-border)" }}
              >
                <h3 className="font-bold" style={{ color: "var(--mq-text)" }}>Новый чат</h3>
                <button
                  onClick={() => setShowNewChatDialog(false)}
                  className="p-1 cursor-pointer"
                  style={{ color: "var(--mq-text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
                  <Input
                    placeholder="Найти по @username или имени..."
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                    className="pl-10 min-h-[40px]"
                    style={{
                      backgroundColor: "var(--mq-input-bg)",
                      border: "1px solid var(--mq-border)",
                      color: "var(--mq-text)",
                    }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {isLoadingNewChat ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--mq-text-muted)" }} />
                  </div>
                ) : newChatFilteredContacts.length > 0 ? (
                  newChatFilteredContacts.map((contact) => (
                    <motion.button
                      key={contact.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectContact(contact)}
                      className="w-full flex items-center gap-3 p-3 hover:opacity-80 transition-opacity text-left cursor-pointer"
                      style={{ borderBottom: "1px solid var(--mq-border)" }}
                    >
                      <div className="relative flex-shrink-0">
                        <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--mq-text)" }}>
                          {contact.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--mq-text-muted)" }}>
                          @{contact.username}
                        </p>
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Пользователи не найдены</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
