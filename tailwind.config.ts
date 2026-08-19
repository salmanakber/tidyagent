import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070B14",
          900: "#0B1220",
          850: "#0F1830",
          800: "#141E36",
          700: "#1C2948",
          600: "#2A3A5C",
          500: "#3D5278",
          400: "#6B7FA3",
          300: "#9AABC8",
          200: "#C5D0E3",
          100: "#E8EDF5",
        },
        amber: {
          50: "#FFF8EB",
          100: "#FFEDC8",
          200: "#FBD88A",
          300: "#F5C14A",
          400: "#E8B86D",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(245, 158, 11, 0.35)",
        card: "0 18px 50px -24px rgba(7, 11, 20, 0.7)",
        panel: "0 30px 80px -32px rgba(7, 11, 20, 0.85)",
      },
      backgroundImage: {
        "brand-gradient":
          "radial-gradient(1200px 600px at 10% -10%, rgba(245,158,11,0.18), transparent 50%), radial-gradient(900px 500px at 100% 0%, rgba(28,41,72,0.9), transparent 45%), linear-gradient(180deg, #0B1220 0%, #070B14 100%)",
        "amber-navy":
          "linear-gradient(135deg, #D97706 0%, #F59E0B 28%, #1C2948 68%, #0B1220 100%)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(3%, -4%) scale(1.08)" },
        },
        "drift-alt": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-4%, 3%) scale(1.06)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "wave-bar": {
          "0%, 100%": { transform: "scaleY(0.45)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        float: "float 4.5s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        "drift-alt": "drift-alt 22s ease-in-out infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "wave-bar": "wave-bar 0.9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
