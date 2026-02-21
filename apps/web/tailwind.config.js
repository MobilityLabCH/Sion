/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0f1117',
          50: '#f7f7f9',
          100: '#ededf1',
          200: '#d3d3de',
          300: '#ababbe',
          400: '#7d7d99',
          500: '#5e5e7a',
          600: '#4b4b63',
          700: '#3d3d52',
          800: '#2d2d3d',
          900: '#1d1d2b',
        },
        accent: {
          DEFAULT: '#5b4fff',
          50: '#f0effe',
          100: '#e4e2fd',
          200: '#cdc9fc',
          300: '#aba4f9',
          400: '#8577f5',
          500: '#5b4fff',
          600: '#4a3ef0',
          700: '#3b2fd4',
          800: '#2f26ab',
          900: '#271f88',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};
