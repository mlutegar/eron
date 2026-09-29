/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#14161B",
          800: "#1D2129",
          700: "#252A34",
          600: "#2F3541",
        },
        line: "#333A47",
        fg: {
          DEFAULT: "#E8EAED",
          muted: "#9AA3B2",
          faint: "#69707E",
        },
        flow: "#3FD68C",
        warn: "#F5B14C",
        danger: "#F0655E",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        pulseFlow: {
          "0%": { transform: "translateX(0)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateX(var(--flow-distance, 100px))", opacity: "0" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        breathe: "breathe 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
