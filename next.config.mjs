/** @type {import('next').NextConfig} */
const isPages = process.env.NEXT_PUBLIC_PAGES === '1'

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  ...(isPages
    ? {
        output: 'export',
        basePath: '/bconfig-dashboard',
        assetPrefix: '/bconfig-dashboard',
        trailingSlash: false,
      }
    : {}),
}

export default nextConfig
