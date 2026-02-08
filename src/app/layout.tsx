import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reyes de la IA Finance | Dashboard",
  description: "Dashboard Financiero de Reyes IA",
  metadataBase: new URL("https://reyes-finance.vercel.app"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Reyes Finance",
  },
  icons: {
    icon: "/isotipo.png",
    apple: "/isotipo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${fontSans.variable} ${fontMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
