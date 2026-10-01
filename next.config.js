/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 *
 * The app serves private study data (PRV reports, uploaded documents) and an account login, so the
 * browser needs to be told not to sniff content types, not to frame the app (clickjacking on the
 * code screen), and not to leak the URL of a private page to a third party.
 *
 * The Content-Security-Policy deliberately covers only the directives that cannot break this app:
 * `frame-ancestors`, `base-uri`, `object-src` and `form-action`. A `script-src` directive is left
 * out on purpose - Next.js emits its own inline bootstrap scripts and the theme script in
 * `app/_shell.tsx` is inline too, so enforcing script sources here would need per-request nonces
 * (a middleware rewrite) to work at all. Adding `'unsafe-inline'` instead would be worse than no
 * directive, since it blocks nothing while looking like protection.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  /**
   * `poweredByHeader` is off by default for Next 14 apps but set explicitly here, so the server does
   * not advertise its framework and version to anything probing the app.
   */
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
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