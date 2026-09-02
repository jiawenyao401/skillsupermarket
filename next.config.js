/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.skillsupermarket.com" }],
        destination: "https://skillsupermarket.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "skill-supermarket.vercel.app" }],
        destination: "https://skillsupermarket.com/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "registry.npmjs.org" },
    ],
  },
};

module.exports = nextConfig;
