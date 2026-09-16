import type { NextConfig } from "next";

const isStaticExport =
  process.env.APPSECGATE_STATIC_EXPORT === "true";

const repositoryBasePath =
  "/appsecgate-platform";

const nextConfig: NextConfig = isStaticExport
  ? {
      output: "export",
      basePath: repositoryBasePath,
      assetPrefix: repositoryBasePath,
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
    }
  : {};

export default nextConfig;
