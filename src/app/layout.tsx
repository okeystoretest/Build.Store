import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
// Self-hosted Inter — keeps builds network-independent and works offline (PWA).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
// Dancing Script — fonte script feminina usada apenas na logo "Build.Sales".
import "@fontsource/dancing-script/600.css";
import "@fontsource/dancing-script/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Build.Sales",
  description: "PDV premium para lojas boutique",
  manifest: "/manifest.json",
  icons: {
    // Favicons pequenos primeiro: o navegador escolhe pelo `sizes`, e sem uma
    // versão de 16/32px ele reduzia o PNG de 192px, borrando o traço fino do
    // "B". O .ico em /favicon.ico atende quem pede a raiz sem ler o HTML.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: { capable: true, title: "Build.Sales", statusBarStyle: "default" },
  other: {
    // `apple-mobile-web-app-capable` (emitida pelo appleWebApp acima) está
    // depreciada; os navegadores pedem a versão padronizada. Mantemos as duas:
    // a da Apple para iOS antigo, esta para o padrão atual. Isso silencia o
    // aviso do console sem perder o comportamento de PWA instalável.
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#fff8f7",
  width: "device-width",
  initialScale: 1,
  // maximumScale removido: travar o zoom prejudica a acessibilidade (impede
  // ampliar o texto). O layout já é legível sem zoom; quem precisar, pode.
  // viewportFit "cover" permite usar a área do notch com as safe-area insets.
  viewportFit: "cover",
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
