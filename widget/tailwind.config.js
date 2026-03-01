/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        redegal: {
          primary: 'var(--rc-primary, #007fff)',
          dark: 'var(--rc-dark, #0066cc)',
          light: 'var(--rc-light, #E0F0FF)',
        },
      },
    },
  },
  plugins: [],
  // Prefix to avoid collisions with host page
  prefix: 'rc-',
};
