import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zonkey.io"),
  title: "Zonkey — Two words. One wild match.",
  description: "Connect two words with Zonkey's AI in eight turns or fewer. Play one free Daily puzzle or go Unlimited.",
  applicationName: "Zonkey",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zonkey — Two words. One wild match.",
    description: "Find your stripe. Connect two words with the AI in eight turns or fewer. A fresh Daily and endless Unlimited games.",
    siteName: "Zonkey",
    url: "/",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10120f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
