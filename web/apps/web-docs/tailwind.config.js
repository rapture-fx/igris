/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'beige-primary': '#f7f7f3',
        'beige-secondary': '#f2f1ed',
        'border-light': 'rgba(156, 163, 175, 0.3)',
        'dark-bg': '#1b1912',
      },
      borderColor: {
        'border-light': 'rgba(156, 163, 175, 0.3)',
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Inconsolata', 'monospace'],
      },
    },
  },
  plugins: [],
};
