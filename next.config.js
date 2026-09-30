/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    /**
     * `pdfkit` reads its standard-font metrics (`.afm`) from disk relative to its own directory.
     * When webpack inlines it into a route chunk, that lookup resolves inside `.next/server/...` and
     * throws ENOENT, so every PDF would 500. Keeping the package external lets Node resolve the
     * real `node_modules/pdfkit/js/data` directory.
     */
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

module.exports = nextConfig;
