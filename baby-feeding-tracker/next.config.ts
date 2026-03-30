import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ביטול מפורש של Turbopack במידה והוא מנסה להיכנס כברירת מחדל
  transpilePackages: [], 
};

export default nextConfig;