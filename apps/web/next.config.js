/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repo/shared ships TypeScript source, not a build output.
  transpilePackages: ["@repo/shared"],
};

export default nextConfig;
