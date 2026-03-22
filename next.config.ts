/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // זה יגרום ל-Vercel להתעלם משגיאות TypeScript בזמן הבנייה
    ignoreBuildErrors: true,
  },
  eslint: {
    // זה יגרום ל-Vercel להתעלם משגיאות עיצוב קוד בזמן הבנייה
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;