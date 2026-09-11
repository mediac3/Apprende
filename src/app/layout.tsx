import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const loraSerif = Lora({
  variable: "--font-serif-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aulnea — Plataforma educativa modular",
  description:
    "Transforme su institución con tecnología educativa modular, intuitiva y legalmente respaldada. Gestión académica, administrativa, comunicación y reportes desde un solo lugar.",
  keywords: [
    "plataforma educativa",
    "gestión escolar",
    "SIE",
    "libros reglamentarios",
    "actas institucionales",
    "comunidad escolar",
    "PWA educativa",
  ],
  authors: [{ name: "Aulnea" }],
  manifest: "/manifest.webmanifest",
  applicationName: "Aulnea",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aulnea",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Aulnea — Plataforma educativa modular",
    description:
      "Gestión académica, administrativa, comunicación y reportes. Modular, intuitiva y legalmente respaldada.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1115" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('aulnea-theme');
                  var theme = stored || 'sereno';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'sereno');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${loraSerif.variable} antialiased`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
