import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zonkey.io"),
  title: "Zonkey — Two minds. One word.",
  description: "You think of a word. The AI does too. Keep connecting until you think alike. Play the free daily word game or go unlimited.",
  applicationName: "Zonkey",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zonkey — Two minds. One word.",
    description: "A little wordplay. A little mind reading. Your daily meeting of minds.",
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
  themeColor: "#f7f7f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
