import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const vt323 = VT323({
  variable: "--font-vt323",
  subsets: ["latin"],
  weight: "400",
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zonkey.io"),
  title: {
    default: "Zonkey — Daily Word Association Game",
    template: "%s | Zonkey",
  },
  description:
    "Play Zonkey, a free daily word association game. Connect with an AI across three rounds, score up to 3,000 points, and compare results or play Unlimited.",
  applicationName: "Zonkey",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zonkey — Daily Word Association Game",
    description:
      "Enter your word, reveal Zonkey's, then keep connecting. Three rounds and five guesses each in Daily, Archive, and Unlimited.",
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
      "Start with your word, reveal Zonkey's, and connect over three rounds. Play the free Daily, Unlimited, or past Dailies in Archive.",
    images: ["/opengraph-image.png"],
  },
};

const themeScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#120b22",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${vt323.variable} ${pressStart.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
