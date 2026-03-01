/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './docs/**/*.{md,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'beige-primary': '#f7f7f3',
        'beige-secondary': '#f2f1ed',
        'dark-bg': '#1b1912',
        foreground: 'hsl(var(--foreground))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        card: 'hsl(var(--card))',
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Inconsolata', 'monospace'],
      },
    },
  },
  plugins: [],
};
