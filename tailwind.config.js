
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // v17 Indigo Palette mapping to 'brand' to minimize refactoring
        brand: {
          50: '#eef2ff',  // indigo-50
          100: '#e0e7ff', // indigo-100
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // indigo-500
          600: '#4f46e5', // indigo-600
          700: '#4338ca', // indigo-700
          800: '#3730a3', // indigo-800
          900: '#312e81', // indigo-900
        }
      }
    },
  },
  plugins: [],
}
