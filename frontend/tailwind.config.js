/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0F0D',        // near-black, body text & headers
        paper: '#F7F5F0',      // warm paper background
        paperdim: '#EFEAE0',   // slightly deeper paper for panels
        due: '#E8542C',        // terracotta-red ink: amount owed OUT (payable)
        settled: '#1F6E5C',    // deep teal-green ink: amount owed IN (receivable) / paid
        stone: '#8A8478',      // muted secondary text
        rule: '#D9D2C3',       // ledger rule lines
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'ledger-lines':
          'repeating-linear-gradient(to bottom, transparent, transparent 43px, #D9D2C3 43px, #D9D2C3 44px)',
      },
    },
  },
  plugins: [],
}
