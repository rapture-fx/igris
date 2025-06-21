/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  safelist: [
    // Preserve commonly used dynamic size classes
    {
      pattern: /^w-(4|5|6|7|8|10|12|16|20|24|32|40|48|56|64|72|80|96)$/,
    },
    {
      pattern: /^h-(4|5|6|7|8|10|12|16|20|24|32|40|48|56|64|72|80|96)$/,
    },
    // Common dynamic colors
    {
      pattern: /^(bg|text|border)-(blue|green|red|yellow|purple|gray|white|black)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    // Grid and flex patterns
    {
      pattern: /^(grid-cols|col-span)-(1|2|3|4|5|6|7|8|9|10|11|12)$/,
    },
    // Common spacing patterns
    {
      pattern: /^(p|m|px|py|mx|my|mt|mb|ml|mr)-(0|1|2|3|4|5|6|8|10|12|16|20|24|32)$/,
    },
    // Animation and transition classes
    'animate-spin',
    'animate-pulse', 
    'animate-bounce',
    'animate-ping',
    'transition-all',
    'transition-colors',
    'transition-opacity',
    'duration-300',
    'duration-500',
    'ease-in-out',
    // Common utility classes
    'transform',
    'transform-gpu',
    'rotate-45',
    'rotate-90',
    'rotate-180',
    'scale-105',
    'scale-110',
    'hover:scale-105',
    'hover:scale-110',
    // Responsive variants for commonly dynamic classes
    'md:block',
    'md:hidden',
    'lg:block', 
    'lg:hidden',
    'sm:text-sm',
    'md:text-base',
    'lg:text-lg',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        'figtree': ['var(--font-figtree)', 'system-ui', 'sans-serif'],
        'apple': ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
            transform: "scale(1)"
          },
          "50%": { 
            boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)",
            transform: "scale(1.05)"
          },
        },
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

