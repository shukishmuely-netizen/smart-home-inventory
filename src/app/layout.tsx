import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

// Lyra design language: Heebo body + Frank Ruhl Libre serif headings.
const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const frankRuhl = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "הבית של ניאו",
  description: "ניהול הבית החכם של ניאו",
  manifest: "/manifest.json",
  appleWebApp: {
    title: "הבית של ניאו",
    statusBarStyle: "default",
    capable: true,
  },
  // הגדרת האייקון למובייל
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${frankRuhl.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}