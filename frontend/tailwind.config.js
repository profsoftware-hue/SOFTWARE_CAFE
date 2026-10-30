/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ccp: {
          navy: '#1A3370',
          deep: '#2B53AE',
          blue: '#486BC6',
          sky: '#A6FDFB',
          teal: '#1A6486',
          green: '#86C954',
          soft: '#EAF2FF',
        },
        blue: {
          50: '#EAF2FF',
          100: '#D6E6FF',
          200: '#B3D1FF',
          300: '#8FBBFF',
          400: '#73B0FD',
          500: '#4C88C8',
          600: '#486BC6',
          700: '#2B53AE',
          800: '#23448F',
          900: '#1A3370',
        },
        cyan: {
          200: '#E8FBFF',
          300: '#C9F8FF',
          400: '#A6FDFB',
          500: '#7FE3EF',
        },
        emerald: {
          100: '#E8F6DE',
          200: '#CBEAB7',
          600: '#5FA83C',
          700: '#356636',
          800: '#2B5229',
        },
      },
      backgroundImage: {
        'ccp-gradient': 'linear-gradient(135deg, #2B53AE 0%, #3A6BC8 45%, #1A6486 100%)',
      },
    },
  },
  plugins: [],
}
