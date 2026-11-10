/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          gold: "#D4AF37",
          goldDark: "#AA7C11",
        },
        amanah: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          dark: "#0b2b1a",
          gold: "#d97706",
        },
      },
    },
  },
  plugins: [],
};
