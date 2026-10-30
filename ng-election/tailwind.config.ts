
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#051F20",
          soft: "#35544E",
          faint: "#6D8980",
        },
        paper: {
          DEFAULT: "#F8FBF9",
          raised: "#FFFFFF",
        },
        rule: "#DCE9E2",
        green: {
          DEFAULT: "#163832",
          dark: "#051F20",
        },
        brand: {
          forest: "#051F20",
          deep: "#0B2B26",
          primary: "#163832",
          action: "#235347",
          sage: "#8EB69B",
          mint: "#DAF1DE",
        },
        status: {
          provisional: "#986C17",
          verified: "#235347",
          disputed: "#A33D3D",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(5, 31, 32, 0.05)",
        elevated: "0 12px 32px rgba(5, 31, 32, 0.09)",
      },
    },
  },
  plugins: [],
};

export default config;
