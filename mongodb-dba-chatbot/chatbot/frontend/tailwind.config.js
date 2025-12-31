/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mongo: {
          green: '#00ED64',
          dark: '#001E2B',
          light: '#E3FCF7',
          gray: '#3D4F58'
        }
      }
    },
  },
  plugins: [],
}
