/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        redegal: {
          primary: 'var(--rc-primary, #E30613)',
          dark: 'var(--rc-dark, #B8050F)',
          light: 'var(--rc-light, #FEE2E2)',
        },
      },
    },
  },
  plugins: [],
  // Prefix to avoid collisions with host page
  prefix: 'rc-',
};
