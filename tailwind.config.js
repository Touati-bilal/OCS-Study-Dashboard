/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#05070d",
          900: "#0a0e1a",
          850: "#0d1220",
          800: "#111827",
          700: "#1a2236",
          600: "#252f47",
        },
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#b8dcff",
          300: "#84c4ff",
          400: "#48a3ff",
          500: "#1e7fff",
          600: "#0d5ff0",
          700: "#0a4bce",
          800: "#0f3fa6",
          900: "#123883",
        },
        accent: {
          cyan: "#22d3ee",
          teal: "#2dd4bf",
          violet: "#a78bfa",
          purple: "#c084fc",
          amber: "#fbbf24",
          rose: "#fb7185",
          emerald: "#34d399",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 30px -8px rgba(30,127,255,0.35)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-glow":
          "radial-gradient(circle at 20% 0%, rgba(30,127,255,0.15), transparent 40%), radial-gradient(circle at 80% 20%, rgba(167,139,250,0.12), transparent 40%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(30,127,255,0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(30,127,255,0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-out infinite",
        float: "float 4s ease-in-out infinite",
      },
      borderRadius: {
        "2xl": "1.1rem",
        "3xl": "1.6rem",
      },
    },
  },
  plugins: [],
};
