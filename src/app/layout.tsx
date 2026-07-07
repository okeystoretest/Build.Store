import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
// Self-hosted Inter — keeps builds network-independent and works offline (PWA).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build.Store",
  description: "PDV premium para lojas boutique",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Build.Store", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fff8f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
