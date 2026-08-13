/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Módulos nativos/Node que não podem ser empacotados pelo webpack: mantê-los
  // como externals no servidor. Argon2 tem binário .node; pg é Node puro.
  // (Next 14: fica sob experimental; em Next 15 vira serverExternalPackages.)
  experimental: {
    serverComponentsExternalPackages: [
      "@node-rs/argon2",
      "pg",
      "lucia",
      "@lucia-auth/adapter-postgresql",
    ],
  },
};

export default nextConfig;
