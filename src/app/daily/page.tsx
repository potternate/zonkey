import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArchiveBrowser } from "@/components/game/archive-browser";
import { toIsoDate } from "@/lib/game/daily";

export const metadata: Metadata = {
  title: "Daily Word Association Puzzle Archive",
  description:
    "Play past Zonkey Daily word association puzzles. Browse the calendar, see your saved scores, and resume unfinished games.",
  alternates: { canonical: "/daily" },
  openGraph: {
    title: "Zonkey Daily Puzzle Archive",
    description:
      "Browse the starting words from every free Zonkey Daily word association puzzle.",
    url: "/daily",
    type: "website",
    siteName: "Zonkey",
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
    title: "Zonkey Daily Puzzle Archive",
    description:
      "Browse the starting words from every free Zonkey Daily word association puzzle.",
    images: ["/opengraph-image.png"],
  },
};

export const dynamic = "force-dynamic";

export default function DailyArchivePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-6 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between gap-4 border-b pb-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span className="brand-mark flex size-11 items-center justify-center rounded-xl border">
            <Image
              src="/zonkey-mark.webp"
              alt=""
              width={29}
              height={34}
              priority
              className="h-8 w-7 object-contain"
            />
          </span>
          <span className="font-heading text-3xl font-bold tracking-[-0.06em]">zonkey</span>
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          All game modes
        </Link>
      </header>

      <section className="py-8 text-center sm:py-10">
        <h1 className="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">Archive</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Choose a past Daily to play, resume, or view your score.
        </p>
      </section>

      <ArchiveBrowser today={toIsoDate(new Date())} />

      <footer className="mt-10 flex justify-center border-t py-6 text-xs text-muted-foreground">
        <Link href="/" className="underline underline-offset-4 hover:text-primary">
          zonkey.io
        </Link>
      </footer>
    </main>
  );
}
