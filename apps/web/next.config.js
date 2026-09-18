/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repo/shared ships TypeScript source, not a build output.
  transpilePackages: ["@repo/shared"],

  // dev and build run on webpack (--webpack in package.json). Shared now uses
  // .ts import extensions, which both bundlers resolve; the alias also covers
  // any NodeNext-style "./x.js" import that points at a .ts file.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
