/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: '',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        accordionSlideDown: {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        accordionSlideUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        accordionSlideDown: 'accordionSlideDown 100ms ease-out',
        accordionSlideUp: 'accordionSlideUp 100ms ease-out',
      },
    },
  },
  plugins: [],
}
