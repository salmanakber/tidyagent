import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#1a1613",
          900: "#221c18",
          850: "#2a2320",
          800: "#332b26",
          700: "#443933",
          600: "#5c4d45",
          500: "#7a675c",
          400: "#9a877a",
          300: "#bba89c",
          200: "#d9cdc4",
          100: "#f0ebe6",
        },
        amber: {
          50: "#FBF4F0",
          100: "#F6E5DC",
          200: "#EBC4B3",
          300: "#DEA089",
          400: "#D48063",
          500: "#c96442",
          600: "#B4532F",
          700: "#8F3F24",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(201, 100, 66, 0.35)",
        card: "0 18px 50px -24px rgba(26, 22, 19, 0.7)",
        panel: "0 30px 80px -32px rgba(26, 22, 19, 0.85)",
      },
      backgroundImage: {
        "brand-gradient":
          "radial-gradient(1200px 600px at 10% -10%, rgba(201,100,66,0.16), transparent 50%), radial-gradient(900px 500px at 100% 0%, rgba(68,57,51,0.55), transparent 45%), linear-gradient(180deg, #221c18 0%, #1a1613 100%)",
        "amber-navy":
          "linear-gradient(135deg, #B4532F 0%, #c96442 28%, #443933 68%, #1a1613 100%)",
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
        "flow-dash": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "card-fill": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        float: "float 4.5s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        "drift-alt": "drift-alt 22s ease-in-out infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "wave-bar": "wave-bar 0.9s ease-in-out infinite",
        "flow-dash": "flow-dash 1.2s linear infinite",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "card-fill": "card-fill 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
