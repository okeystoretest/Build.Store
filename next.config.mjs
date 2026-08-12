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
    // Reduz o paralelismo do build (menos workers de compilação simultâneos)
    // pra diminuir o pico de memória durante "next build". Suspeita: a VPS
    // (Easypanel + Postgres rodando junto) está com pouca RAM livre durante
    // o build, e os workers de compilação estão sendo mortos pelo OOM killer
    // do SO, deixando pra trás resoluções de módulo incompletas/erradas.
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
