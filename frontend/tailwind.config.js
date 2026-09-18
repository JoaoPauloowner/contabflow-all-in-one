/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#020617",
        surface: "#0f172a",
        card: "rgba(15, 23, 42, 0.8)",
        border: "#1e293b",
        primary: {
          DEFAULT: "#059669",
          hover: "#10b981",
          light: "#34d399",
        },
        tealAccent: {
          DEFAULT: "#0d9488",
          hover: "#14b8a6",
          light: "#2dd4bf",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(16, 185, 129, 0.2)",
        tealGlow: "0 0 25px -5px rgba(20, 184, 166, 0.25)",
      },
    },
  },
  plugins: [],
};
