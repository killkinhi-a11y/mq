"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "./MessageBubble";
import { Input } from "@/components/ui/input";
import {
  Lock, Shield, Send, ArrowLeft, Search, ShieldCheck, Phone, Smile, Trash2,
  Plus, Music2, X, Loader2, Copy, Reply, MoreVertical, UserPlus, UserCheck, Users, AlertCircle
} from "lucide-react";
import { simulateEncrypt, getEncryptionStatus, generateMockFingerprint, simulateDecryptSync } from "@/lib/crypto";

interface FriendUser {
  id: string;
  username: string;
  addedAt: string;
}

interface PendingRequest {
  id: string;
  username: string;
  requestId: string;
}

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
    loadMessages,
  } = useAppStore();

  const [inputText, setInputText] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [fingerprint] = useState(generateMockFingerprint);
  const [showEmojis, setShowEmojis] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [contextMenuMsgId, setContextMenuMsgId] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Friends system state
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<Record<string, string>>({});
  const [showFriendRequests, setShowFriendRequests] = useState(false);

  // New chat dialog search results
  const [newChatUsers, setNewChatUsers] = useState<FetchedUser[]>([]);
  const [isLoadingNewChat, setIsLoadingNewChat] = useState(false);

  // Server messages loaded flag
  const [serverMessagesLoaded, setServerMessagesLoaded] = useState<Record<string, boolean>>({});

  // Prevent hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    setIsLoadingFriends(true);
    try {
      const res = await fetch(`/api/friends?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        setPendingRequests(data.pendingRequests || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingFriends(false);
    }
  }, [userId]);

  // Load friends on mount
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // When selecting a contact, load messages from server
  useEffect(() => {
    if (!userId || !selectedContactId) return;
    const cacheKey = `${userId}-${selectedContactId}`;
    if (serverMessagesLoaded[cacheKey]) return;

    const loadServerMessages = async () => {
      try {
        const res = await fetch(`/api/messages?senderId=${userId}&receiverId=${selectedContactId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            const serverMsgs = data.messages.map((m: { id: string; content: string; senderId: string; receiverId: string; encrypted: boolean; createdAt: string; sender: { username: string } }) => ({
              id: m.id,
              content: m.content,
              senderId: m.senderId,
              receiverId: m.receiverId,
              encrypted: m.encrypted,
              createdAt: m.createdAt,
              senderName: `@${m.sender?.username || "user"}`,
            }));
            loadMessages(serverMsgs);
          }
        }
      } catch {
        // silent — use local messages
      } finally {
        setServerMessagesLoaded(prev => ({ ...prev, [cacheKey]: true }));
      }
    };
    loadServerMessages();
  }, [userId, selectedContactId, serverMessagesLoaded, loadMessages]);

  // New chat dialog: search users API with debounce
  useEffect(() => {
    let cancelled = false;
    const q = newChatSearch.trim();
    if (!q) { setNewChatUsers([]); return; }

    const timer = setTimeout(async () => {
      setIsLoadingNewChat(true);
      try {
        const excludeParam = userId ? `&excludeId=${userId}` : "";
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}${excludeParam}`);
        if (!res.ok) { if (!cancelled) setNewChatUsers([]); return; }
        const data = await res.json();
        if (!cancelled) setNewChatUsers(data.users || []);
      } catch {
        if (!cancelled) setNewChatUsers([]);
      } finally {
        if (!cancelled) setIsLoadingNewChat(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [newChatSearch, userId]);

  // Build contact list from friends (not all users)
  const contactList = useMemo(() => {
    return friends.map((f) => ({
      id: f.id,
      name: f.username,
      username: f.username,
      avatar: `https://picsum.photos/seed/${f.username}/100/100`,
      online: false,
      lastSeen: new Date(f.addedAt).toLocaleDateString("ru-RU"),
    }));
  }, [friends]);

  // Filter contacts for sidebar search
  const filteredContacts = useMemo(() => {
    if (!searchContact.trim()) return contactList;
    const q = searchContact.toLowerCase();
    return contactList.filter(c =>
      c.username.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [contactList, searchContact]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) || contactList.find((c) => c.id === selectedContactId),
    [selectedContactId, contacts, contactList]
  );

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

  const getUnreadCount = useCallback((contactId: string) => {
    return unreadCounts[contactId] || 0;
  }, [unreadCounts]);

  // New chat filtered users (exclude already friends)
  const friendIds = useMemo(() => new Set(friends.map(f => f.id)), [friends]);
  const newChatFilteredContacts = useMemo(() => {
    return newChatUsers
      .filter(u => !friendIds.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.username,
        username: u.username,
        avatar: `https://picsum.photos/seed/${u.username}/100/100`,
        online: false,
        lastSeen: new Date(u.createdAt).toLocaleDateString("ru-RU"),
      }));
  }, [newChatUsers, friendIds]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContactId]);

  // Close context menu on click anywhere
  useEffect(() => {
    const close = () => setContextMenuMsgId(null);
    if (contextMenuMsgId) {
      document.addEventListener("click", close);
      document.addEventListener("touchstart", close);
      return () => {
        document.removeEventListener("click", close);
        document.removeEventListener("touchstart", close);
      };
    }
  }, [contextMenuMsgId]);

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
    try {
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

      // Also save to server
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: encryptedContent,
          senderId: userId,
          receiverId: selectedContactId,
          encrypted: true,
        }),
      }).catch(() => {});
    } catch (err) {
      console.error("[MQ Messenger] Failed to send message:", err);
      const msg = {
        id: Date.now().toString(),
        content: inputText.trim(),
        senderId: userId,
        receiverId: selectedContactId,
        encrypted: false,
        createdAt: new Date().toISOString(),
        senderName: `@${username || "user"}`,
      };
      addMessage(msg);

      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: inputText.trim(),
          senderId: userId,
          receiverId: selectedContactId,
          encrypted: false,
        }),
      }).catch(() => {});
    }
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
    setContextMenuMsgId(null);
  };

  const handleCopyMessage = (msg: typeof contactMessages[0]) => {
    try {
      const decrypted = simulateDecryptSync(msg.content);
      navigator.clipboard.writeText(decrypted).catch(() => {});
    } catch {
      navigator.clipboard.writeText(msg.content).catch(() => {});
    }
    setContextMenuMsgId(null);
  };

  const handleReplyMessage = (msg: typeof contactMessages[0]) => {
    let replyText = "";
    try {
      const decrypted = simulateDecryptSync(msg.content);
      replyText = decrypted.length > 40 ? decrypted.slice(0, 40) + "..." : decrypted;
    } catch {
      replyText = msg.content.slice(0, 40) + "...";
    }
    const senderName = msg.senderId === userId ? "Вы" : (selectedContact?.name || "User");
    setInputText(`> ${senderName}: ${replyText}\n`);
    setContextMenuMsgId(null);
    inputRef.current?.focus();
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

  // Send friend request
  const sendFriendRequest = async (targetUserId: string) => {
    if (!userId) return;
    setFriendRequestStatus(prev => ({ ...prev, [targetUserId]: "loading" }));
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: userId, addresseeId: targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFriendRequestStatus(prev => ({ ...prev, [targetUserId]: "sent" }));
        // If auto-accepted (other person had pending request), refresh friends
        if (data.message?.includes("друзья")) {
          fetchFriends();
        }
      } else {
        setFriendRequestStatus(prev => ({ ...prev, [targetUserId]: data.error || "error" }));
      }
    } catch {
      setFriendRequestStatus(prev => ({ ...prev, [targetUserId]: "error" }));
    }
  };

  // Accept / reject friend request
  const handleFriendRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchFriends();
      }
    } catch {
      // silent
    }
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

  // When selecting a contact from new chat (after sending friend request & being accepted)
  const handleSelectContact = (contact: { id: string; name: string; username: string; avatar: string; online: boolean; lastSeen: string }) => {
    addContact(contact);
    setSelectedContact(contact.id);
    setShowNewChatDialog(false);
    setNewChatSearch("");
  };

  // Prevent hydration mismatch — show spinner until client-side mounted
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--mq-bg)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--mq-accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: "var(--mq-bg)", paddingBottom: "calc(56px + 24px)" }}>
      {/* Contacts sidebar */}
      <div
        className={`w-full lg:w-80 flex-shrink-0 ${selectedContactId ? "hidden lg:flex" : "flex"} flex-col`}
        style={{ borderRight: "1px solid var(--mq-border)", height: "calc(100dvh - 80px)" }}
      >
        <div className="p-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--mq-border)" }}>
          <h2 className="font-bold" style={{ color: "var(--mq-text)" }}>Мессенджер</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1" title="Сквозное шифрование">
              <ShieldCheck className="w-4 h-4" style={{ color: "var(--mq-accent)" }} />
              <span className="text-[10px]" style={{ color: "var(--mq-accent)" }}>E2E</span>
            </div>
            {/* Friend requests badge */}
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowFriendRequests(!showFriendRequests)}
                className="p-1.5 rounded-lg cursor-pointer"
                style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
                title="Заявки в друзья"
              >
                <Users className="w-4 h-4" />
              </motion.button>
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full text-[8px] flex items-center justify-center px-0.5"
                  style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setShowNewChatDialog(true); setShowFriendRequests(false); }}
              className="p-1.5 rounded-lg cursor-pointer"
              style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
              title="Новый чат"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Friend requests panel */}
        <AnimatePresence>
          {showFriendRequests && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden flex-shrink-0"
            >
              <div className="p-3" style={{ borderBottom: "1px solid var(--mq-border)" }}>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--mq-text)" }}>
                  Заявки в друзья ({pendingRequests.length})
                </p>
                {pendingRequests.length === 0 ? (
                  <p className="text-[11px]" style={{ color: "var(--mq-text-muted)" }}>Нет заявок</p>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((req) => (
                      <div key={req.requestId} className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ backgroundColor: "var(--mq-input-bg)" }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                          {req.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm flex-1 truncate" style={{ color: "var(--mq-text)" }}>@{req.username}</span>
                        <button onClick={() => handleFriendRequest(req.requestId, "accept")}
                          className="p-1 rounded-md" style={{ color: "#4ade80" }} title="Принять">
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleFriendRequest(req.requestId, "reject")}
                          className="p-1 rounded-md" style={{ color: "#ef4444" }} title="Отклонить">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
            <Input
              placeholder="Поиск друзей..."
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              className="pl-10 min-h-[40px]"
              style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }}
            />
          </div>
        </div>

        <div
          className="mx-3 mb-2 p-2 rounded-lg text-xs flex items-start gap-2 flex-shrink-0"
          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
        >
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--mq-accent)" }} />
          <p style={{ color: "var(--mq-text-muted)" }}>Все сообщения защищены сквозным шифрованием {getEncryptionStatus()}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingFriends ? (
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
                                const decrypted = simulateDecryptSync(lastMsg.content);
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
              <Users className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
              <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                {searchContact.trim() ? "Друзья не найдены" : "У вас пока нет друзей"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--mq-text-muted)", opacity: 0.6 }}>
                Нажмите + чтобы найти и добавить друзей
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!selectedContactId ? "hidden lg:flex" : "flex"}`}
        style={{ height: "calc(100dvh - 80px)" }}>
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div
              className="flex items-center gap-3 p-3 lg:p-4 flex-shrink-0"
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
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
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

              {/* Message list — no AnimatePresence wrapper to avoid React 19 #482 shellSuspendCounter overflow */}
                {groupedMessages.length === 0 && (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>
                      Нет сообщений
                    </p>
                  </div>
                )}

                {groupedMessages.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 rounded-full text-[11px]" style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)", color: "var(--mq-text-muted)" }}>
                        {group.label}
                      </div>
                    </div>
                    {group.messages.map((msg) => {
                      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
                      let longPressTriggered = false;
                      const handleTouchStart = (e: React.TouchEvent) => {
                        longPressTriggered = false;
                        longPressTimer = setTimeout(() => {
                          longPressTriggered = true;
                          const touch = e.touches[0];
                          setContextMenuMsgId({ id: msg.id, x: touch.clientX - 80, y: touch.clientY - 100 });
                        }, 500);
                      };
                      const handleTouchEnd = () => {
                        if (longPressTimer) clearTimeout(longPressTimer);
                      };
                      const handleTouchMove = () => {
                        if (longPressTimer) clearTimeout(longPressTimer);
                      };
                      return (
                      <div
                        key={msg.id}
                        className="relative group/bubble"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenuMsgId({ id: msg.id, x: e.clientX, y: e.clientY });
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                      >
                        <MessageBubble message={msg} currentUserId={userId || undefined} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (longPressTriggered) return;
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setContextMenuMsgId({ id: msg.id, x: rect.right - 160, y: rect.top - 120 });
                          }}
                          className="absolute top-1 right-1 p-1.5 rounded-full z-10 sm:hidden"
                          style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}
                        >
                          <MoreVertical className="w-3.5 h-3.5" style={{ color: "var(--mq-text-muted)" }} />
                        </button>
                        {contextMenuMsgId && contextMenuMsgId.id === msg.id && (
                          <div
                            className="absolute top-1 right-1 z-20 rounded-xl py-1 shadow-2xl min-w-[160px]"
                            style={{
                              backgroundColor: "var(--mq-card)",
                              border: "1px solid var(--mq-border)",
                              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleReplyMessage(msg)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                              style={{ color: "var(--mq-text)" }}
                            >
                              <Reply className="w-3.5 h-3.5" style={{ color: "var(--mq-text-muted)" }} />
                              Ответить
                            </button>
                            <button
                              onClick={() => handleCopyMessage(msg)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                              style={{ color: "var(--mq-text)" }}
                            >
                              <Copy className="w-3.5 h-3.5" style={{ color: "var(--mq-text-muted)" }} />
                              Копировать
                            </button>
                            {msg.senderId === userId && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80 transition-opacity text-left"
                                style={{ color: "#ef4444" }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Удалить
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            {/* @mention dropdown */}
            <AnimatePresence>
              {showMentions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mx-3 mb-1 rounded-xl flex-shrink-0"
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

            {/* Input — always visible at the bottom */}
            <div
              className="p-3 flex items-center gap-2 flex-shrink-0"
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
                className="p-2 rounded-full cursor-pointer flex-shrink-0"
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
                  className="p-3 flex flex-wrap gap-2 justify-center flex-shrink-0"
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
              <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Выберите друга для начала разговора</p>
              <p className="text-xs mt-1" style={{ color: "var(--mq-accent)" }}>Отпечаток ключа: {fingerprint}</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat / Add Friend Dialog */}
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
                <h3 className="font-bold" style={{ color: "var(--mq-text)" }}>Найти и добавить друга</h3>
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
                    placeholder="Поиск по @username или имени..."
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
                  newChatFilteredContacts.map((contact) => {
                    const status = friendRequestStatus[contact.id];
                    return (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3"
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
                        {status === "sent" ? (
                          <span className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ color: "var(--mq-accent)", backgroundColor: "rgba(224,49,49,0.1)" }}>
                            Отправлено
                          </span>
                        ) : status && status !== "loading" ? (
                          <span className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ color: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)" }}>
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Ошибка
                          </span>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => sendFriendRequest(contact.id)}
                            disabled={status === "loading"}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex-shrink-0"
                            style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}
                          >
                            {status === "loading" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            Добавить
                          </motion.button>
                        )}
                      </div>
                    );
                  })
                ) : newChatSearch.trim() ? (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Пользователи не найдены</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Search className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--mq-text-muted)", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "var(--mq-text-muted)" }}>Введите имя или @username для поиска</p>
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
