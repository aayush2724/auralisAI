/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        sans:    ['var(--font-sans)'],
        mono:    ['"JetBrains Mono"', 'Menlo', 'monospace'],
        logo:    ['var(--font-sans)'],
      },
      colors: {
        theme: {
          bg: 'var(--bg-primary)',
          surface: 'var(--bg-glass)',
          'surface-solid': 'var(--bg-glass-strong)',
          panel: 'var(--bg-panel)',
          border: 'var(--border-subtle)',
          'border-strong': 'var(--border-strong)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        auralis: {
          canvas: '#EEF4FB',
          card: '#FFFFFF',
          accent: '#4F46E5',
          teal: '#0D9488',
          text: '#102033',
          textMuted: '#5D6B7C',
          border: '#D7E2EE',
          borderDark: '#B7C8D8',
        }
      },
      animation: {
        blink:   'blink 1s step-end infinite',
        shimmer: 'shimmer 1.5s infinite',
        fade:    'fade-in 260ms ease-out both',
        scale:   'scale-in 260ms ease-out both',
        lift:    'lift-up 260ms ease-out both',
        glow:    'glow-pulse 2.8s ease-in-out infinite',
      },
      keyframes: {
        blink:   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.98)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'lift-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'glow-pulse': { '0%, 100%': { boxShadow: 'var(--glow-primary)' }, '50%': { boxShadow: 'var(--glow-secondary)' } },
      }
    },
  },
  plugins: [],
}
