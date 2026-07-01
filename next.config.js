/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false
  },
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
