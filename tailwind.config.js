/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#1e3330',
        moss: '#2E4A42',
        sage: '#3d6359',
        amber: '#BFA065',
        cream: '#F6F2EA',
        warm: '#F0EBE0',
        sand: '#E8E1D3',
        sky: '#EDE9E0',
        terra: '#A8864E',
        gold: '#BFA065',
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
