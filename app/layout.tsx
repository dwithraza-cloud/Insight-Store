import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://insight-store.example"),
  title: { default: "Insight Store — Smarter tech, better living", template: "%s | Insight Store" },
  description: "Shop trusted electronics, smart devices, computers, gaming and home technology with fast delivery across Pakistan.",
  icons: {
    icon: "/insight-store-logo.png",
    shortcut: "/insight-store-logo.png",
  },
  openGraph: { title: "Insight Store", description: "Smarter tech, better living.", type: "website" },
  twitter: { card: "summary_large_image", title: "Insight Store", description: "Smarter tech, better living." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
