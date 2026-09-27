module.exports = {
  darkMode: ["selector", '[zaui-theme="dark"]'],
  purge: {
    enabled: true,
    content: ["./src/**/*.{js,jsx,ts,tsx,vue}"],
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["Roboto Mono", "monospace"],
      },
      colors: {
        green: {
          50: "#E6FAF5",
          100: "#B3F0E0",
          200: "#80E6CB",
          300: "#4DDCB6",
          400: "#26D0A0",
          500: "#1AB687",
          600: "#0F9968",
          700: "#0A7A52",
          800: "#065C3D",
          900: "#033E28",
        },
        coral: {
          50: "#FFF4F0",
          100: "#FFE4DB",
          200: "#FFC9B8",
          300: "#FFAD94",
          400: "#FF8B6B",
          500: "#FF6B47",
          600: "#E5522E",
          700: "#C23D1D",
          800: "#9E2B0F",
          900: "#7A1C05",
        },
        yellow: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
      },
      backgroundImage: {
        "gradient-pool": "linear-gradient(135deg, #B3F0E0, #FFF4F0)",
        "gradient-warm": "linear-gradient(to right, #26D0A0, #FF8B6B)",
        "gradient-card": "linear-gradient(to bottom right, #E6FAF5, #FFF4F0)",
      },
    },
  },
};
