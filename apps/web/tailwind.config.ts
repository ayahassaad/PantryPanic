import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Same accent as the build-plan doc, so the app and our project
        // tracker feel like one family from day one.
        basil: {
          50: "#F0F5F1",
          100: "#DCE9DF",
          400: "#5C8F68",
          600: "#3F6B4A",
          700: "#31563A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
