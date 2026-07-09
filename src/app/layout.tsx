import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
// Self-hosted Inter — keeps builds network-independent and works offline (PWA).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
// Dancing Script — fonte script feminina usada apenas na logo "Build.Store".
import "@fontsource/dancing-script/600.css";
import "@fontsource/dancing-script/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build.Store",
  description: "PDV premium para lojas boutique",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)bs-theme=(dark|light)/);if(m&&m[1]==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
