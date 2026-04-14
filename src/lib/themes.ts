export interface ThemeConfig {
  id: string;
  name: string;
  background: string;
  card: string;
  cardHover: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
  inputBg: string;
  playerBg: string;
  navBg: string;
  gradient: string;
  glowColor: string;
  className?: string;
}

export const themes: Record<string, ThemeConfig> = {
  default: {
    id: "default",
    name: "Тёмная классика",
    background: "#0e0e0e",
    card: "#1a1a1a",
    cardHover: "#252525",
    accent: "#e03131",
    text: "#f5f5f5",
    textMuted: "#888888",
    border: "#333333",
    inputBg: "#1a1a1a",
    playerBg: "#151515",
    navBg: "#0e0e0eee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(224,49,49,0.08) 0%, transparent 50%)",
    glowColor: "rgba(224,49,49,0.3)",
  },
  ocean: {
    id: "ocean",
    name: "Океан",
    background: "#0a1628",
    card: "#0f2035",
    cardHover: "#153050",
    accent: "#0ea5e9",
    text: "#e0f2fe",
    textMuted: "#64748b",
    border: "#1e3a5f",
    inputBg: "#0f2035",
    playerBg: "#0b1929",
    navBg: "#0a1628ee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(14,165,233,0.1) 0%, transparent 50%)",
    glowColor: "rgba(14,165,233,0.3)",
    className: "ocean-theme",
  },
  neon: {
    id: "neon",
    name: "Неон",
    background: "#0a0a0a",
    card: "#141414",
    cardHover: "#1e1e1e",
    accent: "#f43f5e",
    text: "#fce7f3",
    textMuted: "#7f1d1d",
    border: "#2a1a2a",
    inputBg: "#141414",
    playerBg: "#0d0d0d",
    navBg: "#0a0a0aee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(244,63,94,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.06) 0%, transparent 40%)",
    glowColor: "rgba(244,63,94,0.35)",
    className: "neon-theme",
  },
  sunset: {
    id: "sunset",
    name: "Закат",
    background: "#1a100a",
    card: "#261a10",
    cardHover: "#332218",
    accent: "#f97316",
    text: "#fef3c7",
    textMuted: "#92400e",
    border: "#3d2a15",
    inputBg: "#261a10",
    playerBg: "#1e1409",
    navBg: "#1a100aee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(249,115,22,0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(234,88,12,0.06) 0%, transparent 40%)",
    glowColor: "rgba(249,115,22,0.35)",
    className: "sunset-theme",
  },
  aurora: {
    id: "aurora",
    name: "Аврора",
    background: "#0a0f14",
    card: "#101a22",
    cardHover: "#162530",
    accent: "#34d399",
    text: "#d1fae5",
    textMuted: "#4a6a5a",
    border: "#1a3028",
    inputBg: "#101a22",
    playerBg: "#0c1519",
    navBg: "#0a0f14ee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(52,211,153,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(56,189,248,0.05) 0%, transparent 40%)",
    glowColor: "rgba(52,211,153,0.3)",
    className: "aurora-theme",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Киберпанк",
    background: "#0d0015",
    card: "#1a0025",
    cardHover: "#260035",
    accent: "#ff2a6d",
    text: "#f0e6ff",
    textMuted: "#8a6aaa",
    border: "#3a1050",
    inputBg: "#1a0025",
    playerBg: "#0a0010",
    navBg: "#0d0015ee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(255,42,109,0.1) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(5,217,232,0.06) 0%, transparent 40%)",
    glowColor: "rgba(255,42,109,0.35)",
    className: "cyberpunk-theme",
  },
  synthwave: {
    id: "synthwave",
    name: "Синтвейв",
    background: "#120a20",
    card: "#1c1230",
    cardHover: "#261a40",
    accent: "#e040fb",
    text: "#f3e5f5",
    textMuted: "#7a5a8a",
    border: "#352548",
    inputBg: "#1c1230",
    playerBg: "#0f0818",
    navBg: "#120a20ee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(224,64,251,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(255,110,64,0.05) 0%, transparent 40%)",
    glowColor: "rgba(224,64,251,0.3)",
    className: "synthwave-theme",
  },
};

export function applyThemeToDOM(theme: ThemeConfig, customAccent?: string) {
  const root = document.documentElement;
  const accent = customAccent || theme.accent;

  root.style.setProperty("--mq-bg", theme.background);
  root.style.setProperty("--mq-card", theme.card);
  root.style.setProperty("--mq-card-hover", theme.cardHover);
  root.style.setProperty("--mq-accent", accent);
  root.style.setProperty("--mq-text", theme.text);
  root.style.setProperty("--mq-text-muted", theme.textMuted);
  root.style.setProperty("--mq-border", theme.border);
  root.style.setProperty("--mq-input-bg", theme.inputBg);
  root.style.setProperty("--mq-player-bg", theme.playerBg);
  root.style.setProperty("--mq-nav-bg", theme.navBg);
  root.style.setProperty("--mq-gradient", theme.gradient);
  root.style.setProperty("--mq-glow", theme.glowColor);

  // Remove all theme classes
  const allThemeClasses = ["ocean-theme", "neon-theme", "sunset-theme", "aurora-theme", "cyberpunk-theme", "synthwave-theme"];
  allThemeClasses.forEach(c => root.classList.remove(c));
  if (theme.className) {
    root.classList.add(theme.className);
  }
}
