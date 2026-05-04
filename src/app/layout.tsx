import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VADAI Webhooks",
  description: "Servicio centralizado de webhooks de VADAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn(
        "dark h-full antialiased",
        inter.variable,
        jetbrainsMono.variable
      )}
    >
      <body className="min-h-full bg-vadai-navy text-vadai-text font-sans">
        {children}
      </body>
    </html>
  );
}
