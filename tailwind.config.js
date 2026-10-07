module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        wine: 'rgb(var(--site-primary-rgb, 109 31 52) / <alpha-value>)',
        rose: '#FF5F86',
        blush: 'rgb(var(--site-secondary-rgb, 255 240 244) / <alpha-value>)',
        ivory: 'rgb(var(--site-background-rgb, 255 250 242) / <alpha-value>)',
        gold: 'rgb(var(--site-accent-rgb, 184 145 74) / <alpha-value>)',
        charcoal: 'rgb(var(--site-text-rgb, 23 22 26) / <alpha-value>)',
        'theme-muted': 'var(--site-muted, #6f6470)',
        'theme-surface': 'var(--site-surface, #ffffff)',
        'theme-border': 'var(--site-border, #ead8cb)',
        brand: {
          soft: 'rgb(var(--site-secondary-rgb, 248 232 228) / <alpha-value>)',
          primary: 'rgb(var(--site-primary-rgb, 138 74 66) / <alpha-value>)',
          rose: 'rgb(var(--site-secondary-rgb, 220 168 160) / <alpha-value>)',
          gold: 'rgb(var(--site-accent-rgb, 201 162 111) / <alpha-value>)'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(15, 23, 42, 0.08)'
      },
      fontFamily: {
        display: ['var(--site-heading-font, Georgia, serif)'],
        sans: ['var(--site-body-font, Arial, sans-serif)']
      }
    }
  },
  plugins: []
};
