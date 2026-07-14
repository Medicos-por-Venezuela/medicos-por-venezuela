/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false
  },
  // Permite aislar el build en otra carpeta (p. ej. NEXT_DIST_DIR=.next-e2e para los tests E2E o
  // previews), y así NO compartir/corromper el `.next` del dev server principal del usuario.
  distDir: process.env.NEXT_DIST_DIR || '.next'
}

module.exports = nextConfig
