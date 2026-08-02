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
        theme: {
          bg: 'var(--theme-bg)',
          surface: 'var(--theme-surface)',
          'surface-solid': 'var(--theme-surface-solid)',
          border: 'var(--theme-border)',
          'border-strong': 'var(--theme-border-strong)',
          primary: 'var(--text-primary)',
          muted: 'var(--text-muted)',
        },
        brand: {
          teal: 'var(--brand-teal)',
          indigo: 'var(--brand-indigo)',
        },
        auralis: {
          black:  '#0F172A',
          canvas: '#F8FAFC',
          card:   '#FFFFFF',
          frost:  '#F1F5F9',
          cream:  '#E2E8F0',
          text:   '#334155',
          textDark: '#0F172A',
          textMuted: '#64748B',
          accent: '#0D9488',
          teal:   '#0D9488',
          indigo: '#4F46E5',
          border: '#E2E8F0',
          borderDark: '#CBD5E1',
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
