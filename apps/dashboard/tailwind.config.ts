import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        obsidian: "#0d0b08",
        parchment: "#f7ead2",
        ember: "#d85b24",
        moss: "#267a63",
        gold: "#d7a84a",
        stone: "#a39178",
        surface: "#12121A",
        card: "#1A1A28",
        border: "#2A2A40",
        accent: { primary: "#6E54FF", secondary: "#00E5FF" },
        success: "#00FF88",
        warning: "#FFB800",
        "text-primary": "#F0F0FF",
        "text-muted": "#8888AA",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
