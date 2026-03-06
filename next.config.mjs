/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NODE_ENV === "production" ? "/ai-lab/job-search-agent" : "",
};

export default nextConfig;