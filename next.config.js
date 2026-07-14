/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false
  },
  // Permite aislar el build en otra carpeta (p. ej. NEXT_DIST_DIR=.next-e2e para los tests E2E o
  // previews), y así NO compartir/corromper el `.next` del dev server principal del usuario.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        // Opening this URL directly downloads the file instead of displaying it
        // (Content-Disposition: attachment). It is still rendered normally by <img>.
        source: '/instruccion-jitsi.png',
        headers: [
          {
            key: 'Content-Disposition',
            value: 'attachment; filename="instruccion-videollamada.png"'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
