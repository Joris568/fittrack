/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        // Page background is near-black; `surface` is the raised-card color a
        // couple steps lighter, giving cards visible depth without a hard border.
        bg: {
          DEFAULT: "#0A0D12",
          raised: "#10141B",
        },
        surface: {
          DEFAULT: "#151A22",
          hover: "#1B212C",
        },
        // `gray` keeps its usual light->dark NUMBER order but the actual
        // lightness is flipped for a dark theme: gray-50 is a subtle dark
        // surface tint, gray-900 is near-white text. Every existing
        // bg-gray-50 / text-gray-400 / border-gray-200 class repaints for
        // free without touching each page.
        gray: {
          50: "#171C25",
          100: "#1F2530",
          200: "#2A3140",
          300: "#3A4254",
          400: "#727D93",
          500: "#8890A3",
          600: "#AAB1C2",
          700: "#C7CCD9",
          800: "#E4E7EE",
          900: "#F4F5F9",
        },
        brand: {
          50: "#0F2A1C",
          100: "#153A26",
          200: "#1E5236",
          300: "#227A45",
          400: "#3FDE84",
          500: "#2ECC71",
          600: "#3FDE84",
          700: "#26A85E",
        },
        amber: {
          50: "#2E2410",
          100: "#3D3016",
          200: "#5C4A1F",
          600: "#F2B83D",
          700: "#F5C563",
          800: "#F9D998",
        },
        red: {
          50: "#2E1616",
          100: "#3D1D1D",
          500: "#F0685E",
          600: "#F5847B",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(63,222,132,0.15), 0 4px 16px -4px rgba(63,222,132,0.35)",
      },
    },
  },
  plugins: [],
};
