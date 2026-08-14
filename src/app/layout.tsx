import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre, Assistant, Rubik, Varela_Round } from "next/font/google";
import "./globals.css";

// Five selectable Hebrew fonts (settings screen switches --font-current).
const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const frankRuhl = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"] });
const assistant = Assistant({ variable: "--font-assistant", subsets: ["hebrew", "latin"] });
const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "latin"] });
const varela = Varela_Round({ variable: "--font-varela", weight: "400", subsets: ["hebrew", "latin"] });

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
      <body className={`${heebo.variable} ${frankRuhl.variable} ${assistant.variable} ${rubik.variable} ${varela.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}