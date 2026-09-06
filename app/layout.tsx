import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { PhoneFrame } from "@/components/layout/PhoneFrame";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: "OCS Study Dashboard",
  description: "Tableau de bord personnel — modules, notes, tâches, stage et examens",
  icons: { icon: "/logo.jpg", apple: "/logo.jpg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#05070d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased">
        <PhoneFrame>{children}</PhoneFrame>
      </body>
    </html>
  );
}
