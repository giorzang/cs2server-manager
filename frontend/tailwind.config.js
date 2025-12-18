import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Thêm màu custom cho giống CS2/Gaming
      colors: {
        'cs-dark': '#0f172a',
        'cs-panel': '#1e293b',
        'cs-orange': '#f97316',
      }
    },
  },
  plugins: [typography],
}

