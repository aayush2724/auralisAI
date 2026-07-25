/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'Menlo', 'monospace'],
        logo:    ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      colors: {
        auralis: {
          black:  '#0D1A0E',
          green:  '#1C2E1E',
          sage:   '#4D6D47',
          mist:   '#5A635A',
          frost:  '#F1F3F1',
          paper:  '#FAFBF9',
          cream:  '#EAECE9',
          text:   '#5C6D5C',
          faded:  '#9DB89A',
          accent: '#dd6668',
          dark:   '#0a0a0a',
          border: '#e5e7eb',
        }
      },
      animation: {
        blink:   'blink 1s step-end infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        blink:   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      }
    },
  },
  plugins: [],
}
