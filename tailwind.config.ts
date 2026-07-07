import type { Config } from "tailwindcss";


const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic Material-style tokens (resolved via CSS vars)
        surface: {
          DEFAULT: "var(--surface)",
          dim: "var(--surface-dim)",
          bright: "var(--surface-bright)",
          "container-lowest": "var(--surface-container-lowest)",
          "container-low": "var(--surface-container-low)",
          container: "var(--surface-container)",
          "container-high": "var(--surface-container-high)",
          "container-highest": "var(--surface-container-highest)",
          variant: "var(--surface-variant)",
        },
        "on-surface": {
          DEFAULT: "var(--on-surface)",
          variant: "var(--on-surface-variant)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          container: "var(--primary-container)",
          fixed: "var(--primary-fixed)",
          "fixed-dim": "var(--primary-fixed-dim)",
        },
        "on-primary": {
          DEFAULT: "var(--on-primary)",
          container: "var(--on-primary-container)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          container: "var(--secondary-container)",
        },
        "on-secondary": {
          DEFAULT: "var(--on-secondary)",
          container: "var(--on-secondary-container)",
        },
        tertiary: {
          DEFAULT: "var(--tertiary)",
          container: "var(--tertiary-container)",
        },
        "on-tertiary": {
          DEFAULT: "var(--on-tertiary)",
          container: "var(--on-tertiary-container)",
        },
        error: {
          DEFAULT: "var(--error)",
          container: "var(--error-container)",
        },
        "on-error": {
          DEFAULT: "var(--on-error)",
          container: "var(--on-error-container)",
        },
        outline: {
          DEFAULT: "var(--outline)",
          variant: "var(--outline-variant)",
        },
        "inverse-surface": "var(--inverse-surface)",
        "inverse-on-surface": "var(--inverse-on-surface)",
        "inverse-primary": "var(--inverse-primary)",
        background: "var(--background)",
        "on-background": "var(--on-background)",
      },
      borderRadius: {
        sm: "0.5rem",
        DEFAULT: "1rem",
        md: "1.5rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px",
      },
      spacing: {
        xs: "4px",
        sm: "12px",
        md: "24px",
        lg: "40px",
        xl: "64px",
        gutter: "24px",
        margin: "32px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "1.2", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "1.4", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      boxShadow: {
        // Ambient elevation from the design system
        "level-1": "0px 4px 20px rgba(232, 168, 168, 0.08)",
        "level-2": "0px 12px 32px rgba(74, 63, 63, 0.05)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
