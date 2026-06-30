/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'orca-primary': '#8740D5',
        'orca-primary-hover': '#6f33ab',
        'orca-bg1': '#FAFAFC',
        'orca-bg2': '#F5F4F9',
        'orca-subtle': '#EBE8EE',
        'orca-muted': '#DAD8E3',
        'orca-focus': '#762FC4',
        'orca-blue': '#2F80ED',
        'orca-blue-hover': '#205EB1',
        'orca-error': '#EA4747',
        'orca-error-hover': '#d13d3d',
      },
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
      opacity: {
        32: '0.32',
      },
    },
  },
  plugins: [],
}