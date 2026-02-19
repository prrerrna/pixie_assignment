const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Tell Next.js this IS the project root (avoids monorepo inference warning)
    outputFileTracingRoot: path.join(__dirname),

    // Allow frontend to call backend at localhost:4000 during dev
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;

