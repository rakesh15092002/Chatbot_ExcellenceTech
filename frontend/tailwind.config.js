/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'; // Add this import

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    typography, // Use the imported variable here
  ],
}