/** @type {import('tailwindcss').Config} */
module.exports = {
  important: '#app',
  corePlugins: {},
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: {
      white: '#FFFFFF',
      blue: '#5DE5FF',
      'midnight-blue': '#003C5A',
      yellow: '#FFDE4E',
      pink: '#FF6397',
      'coral-pink': '#FF6D9D',
      orange: '#FFA957',
      turquoise: '#4BEFBD',
      purple: '#CE8FFF',
      'dark-blue': '#172E59',
      'teal-blue': '#00678C',
      black: '#1D1D1D',
    },
  },
  plugins: [require('@tailwindcss/forms'), require('daisyui')],
};
