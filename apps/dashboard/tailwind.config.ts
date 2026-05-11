import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
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
