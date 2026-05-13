/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@0gclawforge/agents", "@0gclawforge/sdk", "@0gclawforge/shared"],
  experimental: {
    serverComponentsExternalPackages: ["discord.js", "@discordjs/ws", "zlib-sync"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "discord.js": "commonjs discord.js",
        "@discordjs/ws": "commonjs @discordjs/ws",
        "zlib-sync": "commonjs zlib-sync",
      });
    }
    return config;
  },
};

module.exports = nextConfig;
