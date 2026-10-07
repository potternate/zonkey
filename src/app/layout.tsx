import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zonkey.io"),
  title: {
    default: "Zonkey — Daily Word Association Game",
    template: "%s | Zonkey",
  },
  description:
    "Play Zonkey, a free daily word association game. Connect with an AI across five rounds, score up to 5,000 points, and compare results or play Unlimited.",
  applicationName: "Zonkey",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zonkey — Daily Word Association Game",
    description:
      "Five Daily rounds, five guesses each. Connect two words with an AI, score up to 5,000 points, or play Unlimited.",
    siteName: "Zonkey",
    url: "/",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Zonkey zebra mascot on a dark striped background",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zonkey — Daily Word Association Game",
    description:
      "Connect two starting words with an AI. Play one free shared Daily or go Unlimited.",
    images: ["/opengraph-image.png"],
  },
};

const themeScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17120e",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
