"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { Music, Mail, Eye, EyeOff, Loader2, ArrowLeft, AtSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AuthView() {
  const { authStep, setAuthStep, setAuth } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setAuthStep("confirm");
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setAuth(data.userId, data.username, data.email);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const email = formData.email || loginData.email;
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setAuthStep("confirmed");
      setAuth(data.userId, data.username, email);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setAuth("demo-user-id", "Демо", "demo@mqplayer.com");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: "var(--mq-bg)" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--mq-gradient)" }} />

      <AnimatePresence mode="wait">
        {authStep === "login" && (
          <motion.div key="login" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
            className="w-full max-w-md relative z-10">
            <div className="rounded-2xl p-6 lg:p-8"
              style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
              <div className="flex items-center justify-center gap-2 mb-6">
                <Music className="w-8 h-8" style={{ color: "var(--mq-accent)" }} />
                <h1 className="text-2xl font-bold" style={{ color: "var(--mq-text)" }}>MQ Player</h1>
              </div>

              <h2 className="text-xl font-semibold text-center mb-6" style={{ color: "var(--mq-text)" }}>
                Вход в аккаунт
              </h2>

              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg text-sm"
                  style={{ backgroundColor: "rgba(224,49,49,0.15)", color: "#ff6b6b", border: "1px solid rgba(224,49,49,0.3)" }}>
                  {error}
                </motion.div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm mb-1 block" style={{ color: "var(--mq-text-muted)" }}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
                    <Input type="email" placeholder="your@email.com" value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10" style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
                  </div>
                </div>

                <div>
                  <label className="text-sm mb-1 block" style={{ color: "var(--mq-text-muted)" }}>Пароль</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••" value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pr-10" style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mq-text-muted)" }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button onClick={handleLogin} disabled={loading || !loginData.email || !loginData.password}
                  className="w-full min-h-[44px]" style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Войти"}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: "1px solid var(--mq-border)" }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 text-xs" style={{ backgroundColor: "var(--mq-card)", color: "var(--mq-text-muted)" }}>или</span>
                  </div>
                </div>

                <Button variant="outline" onClick={handleDemoLogin} className="w-full min-h-[44px]"
                  style={{ borderColor: "var(--mq-border)", color: "var(--mq-text-muted)" }}>
                  Демо-режим
                </Button>

                <p className="text-center text-sm" style={{ color: "var(--mq-text-muted)" }}>
                  Нет аккаунта?{" "}
                  <button onClick={() => { setAuthStep("register"); setError(""); }} className="font-medium" style={{ color: "var(--mq-accent)" }}>
                    Зарегистрироваться
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {authStep === "register" && (
          <motion.div key="register" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-md relative z-10">
            <div className="rounded-2xl p-6 lg:p-8"
              style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
              <button onClick={() => { setAuthStep("login"); setError(""); }} className="flex items-center gap-1 mb-4" style={{ color: "var(--mq-text-muted)" }}>
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Назад</span>
              </button>

              <div className="flex items-center justify-center gap-2 mb-6">
                <Music className="w-8 h-8" style={{ color: "var(--mq-accent)" }} />
                <h1 className="text-2xl font-bold" style={{ color: "var(--mq-text)" }}>MQ Player</h1>
              </div>

              <h2 className="text-xl font-semibold text-center mb-6" style={{ color: "var(--mq-text)" }}>
                Регистрация
              </h2>

              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg text-sm"
                  style={{ backgroundColor: "rgba(224,49,49,0.15)", color: "#ff6b6b", border: "1px solid rgba(224,49,49,0.3)" }}>
                  {error}
                </motion.div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm mb-1 block" style={{ color: "var(--mq-text-muted)" }}>Имя пользователя</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
                    <Input placeholder="username" value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.replace("@", "").replace(/\s/g, "") })}
                      className="pl-10" style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: "var(--mq-text-muted)" }}>
                    Отображается как @{formData.username || "..."}
                  </p>
                </div>

                <div>
                  <label className="text-sm mb-1 block" style={{ color: "var(--mq-text-muted)" }}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--mq-text-muted)" }} />
                    <Input type="email" placeholder="your@email.com" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10" style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
                  </div>
                </div>

                <div>
                  <label className="text-sm mb-1 block" style={{ color: "var(--mq-text-muted)" }}>Пароль</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="Минимум 6 символов" value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pr-10" style={{ backgroundColor: "var(--mq-input-bg)", border: "1px solid var(--mq-border)", color: "var(--mq-text)" }} />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mq-text-muted)" }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button onClick={handleRegister} disabled={loading || !formData.username || !formData.email || !formData.password}
                  className="w-full min-h-[44px]" style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Создать аккаунт"}
                </Button>

                <p className="text-center text-sm" style={{ color: "var(--mq-text-muted)" }}>
                  Уже есть аккаунт?{" "}
                  <button onClick={() => { setAuthStep("login"); setError(""); }} className="font-medium" style={{ color: "var(--mq-accent)" }}>
                    Войти
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {authStep === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-md relative z-10">
            <div className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: "var(--mq-card)", border: "1px solid var(--mq-border)" }}>
              <Mail className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--mq-accent)" }} />
              <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--mq-text)" }}>Подтвердите почту</h2>
              <p className="text-sm mb-6" style={{ color: "var(--mq-text-muted)" }}>
                Мы отправили письмо на {formData.email}. Нажмите кнопку ниже для симуляции подтверждения.
              </p>
              <Button onClick={handleConfirm} disabled={loading} className="w-full min-h-[44px]"
                style={{ backgroundColor: "var(--mq-accent)", color: "var(--mq-text)" }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Подтвердить почту"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
