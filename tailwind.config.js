/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f2f6f4',
          100: '#dfe9e4',
          200: '#bed3ca',
          300: '#93b5a8',
          400: '#699385',
          500: '#4d786a',
          600: '#3b5f54',
          700: '#324d45',
          800: '#2a3f39',
          900: '#0f2b24',
          950: '#081b17',
        },
        jade: {
          50: '#eefbf3',
          100: '#d6f5e3',
          200: '#b0e9cb',
          300: '#7bd7ab',
          400: '#45bd88',
          500: '#21a26e',
          600: '#138259',
          700: '#106849',
          800: '#10523c',
          900: '#0e4332',
        },
        amber: {
          50: '#fdf8ed',
          100: '#f9edcc',
          200: '#f2d995',
          300: '#eabf5d',
          400: '#e3a532',
          500: '#d3861a',
          600: '#b96513',
          700: '#934913',
          800: '#793c16',
          900: '#673216',
        },
        paper: '#f5f6f2',
        bench: '#e7e3d8',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 43, 36, 0.06), 0 8px 24px -12px rgba(15, 43, 36, 0.18)',
        float: '0 18px 48px -18px rgba(15, 43, 36, 0.35)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        swing: {
          '0%': { transform: 'rotate(-4deg)' },
          '100%': { transform: 'rotate(4deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 300ms ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        swing: 'swing 1.2s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
