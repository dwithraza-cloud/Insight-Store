import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://insight-store-pk.dwithraza.chatgpt.site"),
  title: { default: "Insight Store — Smarter tech, better living", template: "%s | Insight Store" },
  description: "Shop trusted electronics, smart devices, computers, gaming and home technology with fast delivery across Pakistan.",
  icons: {
    icon: "/insight-store-logo.png",
    shortcut: "/insight-store-logo.png",
  },
  openGraph: { title: "Insight Store", description: "Smarter tech, better living.", type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Insight Store — Smarter tech. Better living." }] },
  twitter: { card: "summary_large_image", title: "Insight Store", description: "Smarter tech, better living.", images: ["/og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
