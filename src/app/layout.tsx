import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeOptionsVars } from "@/components/theme-options-vars";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apprende — Plataforma educativa modular",
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
    "Apprende",
  ],
  authors: [{ name: "Apprende" }],
  manifest: "/manifest.webmanifest",
  applicationName: "Apprende",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Apprende",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Apprende — Plataforma educativa modular",
    description:
      "Gestión académica, administrativa, comunicación y reportes. Modular, intuitiva y legalmente respaldada.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFBFC" },
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
                  var stored = localStorage.getItem('apprende-theme') || localStorage.getItem('aulnea-theme');
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
        className={`${openSans.variable} antialiased`}
        style={{ fontFamily: "var(--font-open-sans), ui-sans-serif, system-ui, sans-serif" }}
      >
        {children}
        {/* [theme-options] Inyecta variables CSS del tema (cliente, sin afectar render del servidor) */}
        <ThemeOptionsVars />
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
