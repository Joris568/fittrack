/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        display: ["Bricolage Grotesque", "DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        // Warm paper background, white cards, ink text, one orange accent.
        bg: {
          DEFAULT: "#F5F3EE",
          raised: "#FBFAF7",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          hover: "#FAF8F4",
        },
        gray: {
          50: "#F8F6F1", 100: "#EFECE5", 200: "#E2DED5", 300: "#CFCAC0",
          400: "#8F8A7F", 500: "#7C776C", 600: "#5D594F", 700: "#403D35",
          800: "#26241F", 900: "#161512",
        },
        brand: {
          50: "#FFF1EA", 100: "#FFE0D1", 200: "#FFC2A6", 300: "#FF9A6E",
          400: "#FF7A45", 500: "#E5481A", 600: "#C23F0C", 700: "#A33309",
        },
        amber: {
          50: "#FFF7E0", 100: "#FFEDB8", 200: "#FFDD85",
          600: "#A8650A", 700: "#8A5208", 800: "#6B3F06",
        },
        red: {
          50: "#FDECEA", 100: "#FADAD6", 500: "#D93A2B", 600: "#C0301F",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,21,18,0.04), 0 6px 20px -10px rgba(22,21,18,0.12)",
        glow: "none",
      },
    },
  },
  plugins: [],
};
