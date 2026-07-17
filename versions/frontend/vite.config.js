import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Enforce relative asset pathways for S3/CloudFront static hosting
  define: {
    'process.env': {}, // Polyfill process.env to prevent crashes in react-rnd/react-draggable
  },
})
