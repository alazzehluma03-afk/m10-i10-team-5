/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          DEFAULT: "#2D5016",
          light: "#3d6b1e",
          dark: "#1e3a0e",
        },
        saffron: {
          DEFAULT: "#E8A71A",
          light: "#f0bb47",
          dark: "#c68e12",
        },
        cream: {
          DEFAULT: "#F9F7F4",
          dark: "#ede9e4",
        },
        "warm-gray": {
          DEFAULT: "#A89968",
          light: "#bfb08a",
          dark: "#8a7d50",
        },
        charcoal: {
          DEFAULT: "#2C2C2C",
          light: "#3d3d3d",
        },
      },
      fontFamily: {
        display: ['"Inter Tight"', "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      maxWidth: {
        "4xl": "56rem",
      },
    },
  },
  plugins: [],
};
