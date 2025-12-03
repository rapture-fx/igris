/** @type {import('tailwindcss').Config} */
module.exports = {
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
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Inconsolata', 'monospace'],
      },
    },
  },
  plugins: [],
};
