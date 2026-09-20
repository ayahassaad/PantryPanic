import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy accent from the original plain build — kept in place
        // (not deleted) until every page using it has been migrated to
        // the new palette below, so untouched pages don't silently lose
        // their color mid-rollout.
        basil: {
          50: "#F0F5F1",
          100: "#DCE9DF",
          400: "#5C8F68",
          600: "#3F6B4A",
          700: "#31563A",
        },

        // The new "hand-drawn fruit" visual direction — see the
        // Pantry Panic visual-direction design canvas for the source.
        // Warm cream surfaces, an ink outline/text color, and a bright
        // fruit-inspired accent family. Shade steps mirror `basil`'s
        // convention (50 = light tint, 400 = vivid block, 600/700 =
        // darker for text/hover) so both scales behave the same way.
        cream: {
          DEFAULT: "oklch(97% 0.018 85)", // page background
          deep: "oklch(93% 0.03 85)", // section blocks, subtle panels
          card: "oklch(99% 0.006 85)", // card / surface fill
        },
        ink: {
          DEFAULT: "oklch(24% 0.03 150)", // primary text, outlines
          soft: "oklch(45% 0.02 150)", // secondary text
          faint: "oklch(70% 0.02 150)", // disabled / placeholder text
        },
        tomato: {
          50: "oklch(95% 0.03 25)",
          400: "oklch(62% 0.19 25)",
          600: "oklch(50% 0.18 25)",
          700: "oklch(42% 0.16 25)",
        },
        citrus: {
          50: "oklch(96% 0.03 95)",
          400: "oklch(80% 0.15 95)",
          600: "oklch(65% 0.14 90)",
          700: "oklch(55% 0.13 88)",
        },
        leaf: {
          50: "oklch(95% 0.03 145)",
          400: "oklch(62% 0.13 145)",
          600: "oklch(48% 0.12 145)",
          700: "oklch(40% 0.11 145)",
        },
        carrot: {
          50: "oklch(95% 0.03 55)",
          400: "oklch(68% 0.17 55)",
          600: "oklch(56% 0.16 52)",
          700: "oklch(47% 0.15 50)",
        },
        blueberry: {
          50: "oklch(95% 0.02 290)",
          400: "oklch(65% 0.13 290)",
          600: "oklch(52% 0.13 290)",
          700: "oklch(42% 0.12 290)",
        },
      },
      fontFamily: {
        // Prepending onto the default stack (rather than replacing it)
        // means every existing page picks up Nunito immediately via
        // Tailwind's base reset, with the same system-font fallback
        // chain as before if the Google Font fails to load.
        sans: ["var(--font-nunito)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-fredoka)", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

export default config;
