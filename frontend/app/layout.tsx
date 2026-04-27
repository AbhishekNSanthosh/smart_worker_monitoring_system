import type { Metadata } from "next";
import "./globals.css";
import SplashScreen from "./components/SplashScreen";

export const metadata: Metadata = {
  title: "Smart Worker Monitoring System | AI-Powered Workplace Analytics",
  description:
    "Enterprise-grade AI surveillance dashboard for smart factories and workplace monitoring. Analyze worker activity, track presence, and monitor zone occupancy in real-time.",
  keywords: ["AI monitoring", "worker safety", "CCTV analytics", "smart factory", "workplace intelligence"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
