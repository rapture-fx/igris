/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'custom-gray': '#1F1F1F',
        'beige-secondary': '#f6f1ec',
        'dark-bg': '#110f0f',
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        soft: {
          blue: '#007AFF',
          gray: '#F2F2F7',
          white: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'sans-serif'],
        'sf': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'system-ui', 'sans-serif'],
        'sf-text': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'system-ui', 'sans-serif'],
        'cs-monkey': ['Space Mono', 'monospace'],
        'inconsolata': ['Inconsolata', 'monospace'],
        'ibm-plex-mono': ['IBM Plex Mono', 'monospace'],
        'sf-mono': ['SF Mono', 'monospace'],
        'pixel': ['VT323', 'monospace'],
        'clean-pixel': ['Roboto Mono', 'monospace'],
        'dot-mincho': ['VT323', 'monospace'],
        'inter': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'hero': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.1' }],
        'section': ['clamp(1.8rem, 3vw, 2.5rem)', { lineHeight: '1.2' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      backdropBlur: {
        'xl': '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
