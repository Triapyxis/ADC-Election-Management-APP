import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#14201a", soft: "#4a5a50", faint: "#7b8a80" },
        paper: { DEFAULT: "#f7f6f2", raised: "#ffffff" },
        rule: "#dcdad2",
        green: { DEFAULT: "#0b6b3a", dark: "#07492a" },
        status: { provisional: "#8a6100", verified: "#0b6b3a", disputed: "#a62b1f" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      borderRadius: { DEFAULT: "4px" },
    },
  },
} satisfies Config;
