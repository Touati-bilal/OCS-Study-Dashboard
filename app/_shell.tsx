import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

export const rootMetadata: Metadata = {
  title: "OCS Study Dashboard",
  description: "Tableau de bord personnel — modules, notes, tâches, stage et examens",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OCS",
  },
};

export const rootViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Runs before first paint, so the stored theme is applied without a flash. It reads only the theme
 * key and touches nothing private.
 */
const THEME_INIT_SCRIPT = `
try {
  var raw = window.localStorage.getItem("ocs-study-dashboard");
  var theme = raw ? JSON.parse(raw).state.theme : "black";
  document.documentElement.setAttribute("data-theme", theme === "white" ? "white" : "black");
} catch (e) {}
`;

/**
 * The `<html>`/`<body>` shell shared by both root layouts.
 *
 * The app deliberately has *two* root layouts - one per route group - because `AppShell` renders
 * only a loading spinner until the browser has hydrated. Anything inside it is never server
 * rendered, so a server component placed under it cannot authorise a request. The private area
 * needs the opposite: an authorisation check that runs before any markup exists. Keeping the
 * document shell here lets each group choose its own body without duplicating fonts, metadata or
 * the theme script.
 */
export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <meta name="theme-color" content="#000000" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
