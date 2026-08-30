import type { Metadata, Viewport } from "next";
import { Heebo, Frank_Ruhl_Libre, Assistant, Rubik, Varela_Round } from "next/font/google";
import "./globals.css";

// Five selectable Hebrew fonts (settings screen switches --font-current).
// Varela Round ships a single weight on Google Fonts, so under that choice the
// hierarchy is carried by size and colour rather than weight.
const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const frankRuhl = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"] });
const assistant = Assistant({ variable: "--font-assistant", subsets: ["hebrew", "latin"] });
const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "latin"] });
const varela = Varela_Round({ variable: "--font-varela", weight: "400", subsets: ["hebrew", "latin"] });

// Default browser chrome colour; the app re-points this at runtime to match the
// theme the user picked, so the dark theme does not get a light status bar.
export const viewport: Viewport = {
  themeColor: "#f7f4ff",
  width: "device-width",
  initialScale: 1,
};

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