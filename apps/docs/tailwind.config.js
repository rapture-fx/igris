/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'schlep-blue': '#667eea',
        'schlep-purple': '#764ba2',
        'schlep-orange': '#ff6b6b',
      },
      fontFamily: {
        'mono': ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: {
              backgroundColor: '#f8fafc',
              padding: '0.25rem 0.375rem',
              borderRadius: '0.25rem',
              fontSize: '0.875em',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}