/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        jakarta: ["Plus Jakarta Sans", "sans-serif"],
      },
      colors: {
        blue: {
          deep: "#1B4F8C",
          mid: "#2E7DD1",
          light: "#82B8E8",
          pale: "#D6EAFE",
        },
        pink: {
          deep: "#C2527A",
          mid: "#E07FAA",
          light: "#F2B8CF",
          pale: "#FDE8F2",
        },
        gold: {
          DEFAULT: "#B8962E",
          light: "#E8D18A",
        },
        ink: "#111827",
      },
      animation: {
        "fade-up": "fadeUp 0.7s ease forwards",
        "orb-pulse": "orbPulse 2s ease-in-out infinite",
        "bird-glide": "birdGlide 3s ease-in-out infinite alternate",
        "confetti-fall": "confettiFall 2s ease infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: "translateY(24px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        orbPulse: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        birdGlide: {
          from: { transform: "translateY(-10px) rotate(-2deg)" },
          to: { transform: "translateY(10px) rotate(2deg)" },
        },
        confettiFall: {
          "0%": { opacity: 0, transform: "translateY(-20px) rotate(0deg)" },
          "10%": { opacity: 1 },
          "90%": { opacity: 0.6 },
          "100%": { opacity: 0, transform: "translateY(100vh) rotate(720deg)" },
        },
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};
