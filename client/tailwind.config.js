/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf3",
          100: "#d6fadf",
          400: "#34d17a",
          500: "#16b862",
          600: "#0e9950",
          700: "#0c7a41",
        },
      },
    },
  },
  plugins: [],
};
