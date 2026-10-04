import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  dailyArchiveDates,
  dailyArchiveEntry,
  formatArchiveDate,
} from "@/lib/game/archive";

export const metadata: Metadata = {
  title: "Daily Word Association Puzzle Archive",
  description:
    "Browse every Zonkey Daily word association puzzle by date and revisit the two starting words shared by all players.",
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
  const entries = dailyArchiveDates()
    .reverse()
    .map((date) => dailyArchiveEntry(date))
    .filter((entry) => entry !== null);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 py-6 sm:px-10 sm:py-10">
      <header className="flex items-center justify-between gap-4 border-b pb-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span className="flex size-11 items-center justify-center rounded-xl border bg-card">
            <Image
              src="/zonkey-mark.webp"
              alt=""
              width={29}
              height={34}
              priority
              className="h-8 w-7 object-contain"
            />
          </span>
          <span className="text-2xl font-extrabold tracking-[-0.07em]">zonkey</span>
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Play today&rsquo;s puzzle
        </Link>
      </header>

      <section className="py-12 text-center sm:py-16">
        <p className="eyebrow text-primary">One shared pair every day</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.06em] sm:text-6xl">
          Daily puzzle archive
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Explore the two starting words from every Zonkey Daily. Each date
          gives every player the same word association puzzle.
        </p>
      </section>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.date}>
            <Link
              href={`/daily/${entry.date}`}
              className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <span className="flex items-center justify-between gap-4">
                <span className="eyebrow text-primary">Daily #{entry.number}</span>
                <time dateTime={entry.date} className="text-xs text-muted-foreground">
                  {formatArchiveDate(entry.date)}
                </time>
              </span>
              <span className="mt-8 flex items-center gap-3 text-xl font-bold tracking-tight">
                <span>{entry.pair.a}</span>
                <span className="text-primary">↔</span>
                <span>{entry.pair.b}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <footer className="mt-14 flex items-center justify-between gap-4 border-t py-6 text-xs text-muted-foreground">
        <span>Two words. One wild match.</span>
        <Link href="/" className="underline underline-offset-4 hover:text-primary">
          zonkey.io
        </Link>
      </footer>
    </main>
  );
}
