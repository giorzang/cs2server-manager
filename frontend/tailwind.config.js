import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 60-30-10 Rule Palette
        'primary': '#020617',    // 60% - Main Background (Deepest Slate/Black)
        'secondary': '#1e293b',  // 30% - Cards/Components (Slate 800)
        'accent': '#f97316',     // 10% - Action/Highlight (Orange 500)
        
        // Extended shades for better UI depth (optional but helpful)
        'secondary-hover': '#334155', // Slate 700
        'accent-hover': '#ea580c',    // Orange 600
        
        // Legacy/Specific Support if needed
        'cs-dark': '#0f172a',
        'cs-panel': '#1e293b',
        'cs-orange': '#f97316',
      }
    },
  },
  plugins: [typography],
}