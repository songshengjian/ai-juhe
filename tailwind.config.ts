import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Arial", "sans-serif"]
      },
      keyframes: {
        "auth-orb-one": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(36px, -28px, 0) scale(1.08)" }
        },
        "auth-orb-two": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(-32px, 30px, 0) scale(1.12)" }
        },
        "auth-float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "auth-drift": {
          "0%, 100%": { transform: "rotate(-4deg) translateY(0px)" },
          "50%": { transform: "rotate(-2deg) translateY(-14px)" }
        },
        "auth-scan": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(240%)" }
        }
      },
      animation: {
        "auth-orb-one": "auth-orb-one 8s ease-in-out infinite",
        "auth-orb-two": "auth-orb-two 10s ease-in-out infinite",
        "auth-float": "auth-float 5s ease-in-out infinite",
        "auth-drift": "auth-drift 7s ease-in-out infinite",
        "auth-scan": "auth-scan 4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
