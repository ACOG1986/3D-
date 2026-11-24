/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        draft: ['"PT Sans Narrow"', 'Arial Narrow', 'sans-serif'],
      },
      colors: {
        accent: { DEFAULT: '#2563eb', soft: '#dbeafe' },
      },
    },
  },
  plugins: [],
};
