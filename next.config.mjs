/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./seed/**/*"] },
};
export default config;
