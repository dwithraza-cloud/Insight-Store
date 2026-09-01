import type { Metadata } from "next";
import { Poppins, Roboto } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://insight-store-pk.dwithraza.chatgpt.site"),
  title: { default: "Insight Store — Smarter tech, better living", template: "%s | Insight Store" },
  description: "Shop trusted electronics, smart devices, computers, gaming and home technology with fast delivery across Pakistan.",
  icons: {
    icon: "/insight-store-logo.webp",
    shortcut: "/insight-store-logo.webp",
  },
  openGraph: { title: "Insight Store", description: "Smarter tech, better living.", type: "website", images: [{ url: "/og.webp", width: 1200, height: 630, alt: "Insight Store — Smarter tech. Better living." }] },
  twitter: { card: "summary_large_image", title: "Insight Store", description: "Smarter tech, better living.", images: ["/og.webp"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${roboto.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
