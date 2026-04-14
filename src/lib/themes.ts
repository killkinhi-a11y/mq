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
  gothic: {
    id: "gothic",
    name: "Готика",
    background: "#0a0a12",
    card: "#15152a",
    cardHover: "#1e1e3a",
    accent: "#8b5cf6",
    text: "#e8e0f0",
    textMuted: "#7a7290",
    border: "#2a2a4a",
    inputBg: "#15152a",
    playerBg: "#0d0d1a",
    navBg: "#0a0a12ee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.1) 0%, transparent 50%)",
    glowColor: "rgba(139,92,246,0.3)",
    className: "gothic-theme",
  },
  minecraft: {
    id: "minecraft",
    name: "Minecraft",
    background: "#2c1e0e",
    card: "#3d2b1a",
    cardHover: "#4a3520",
    accent: "#4ade80",
    text: "#e8dcc8",
    textMuted: "#9a8a6a",
    border: "#5a4a2a",
    inputBg: "#3d2b1a",
    playerBg: "#2a1c0c",
    navBg: "#2c1e0eee",
    gradient: "radial-gradient(ellipse at 20% 50%, rgba(74,222,128,0.06) 0%, transparent 50%)",
    glowColor: "rgba(74,222,128,0.3)",
    className: "minecraft-theme",
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
  root.classList.remove("gothic-theme", "minecraft-theme");
  if (theme.className) {
    root.classList.add(theme.className);
  }
}
