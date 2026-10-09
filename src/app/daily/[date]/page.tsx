import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  dailyArchiveEntry,
  formatArchiveDate,
} from "@/lib/game/archive";
import { JsonLd } from "@/components/seo/json-ld";
import { dailyPairsForPuzzle } from "@/lib/game/daily-run";
import { playerFirstDaily } from "@/lib/game/opening";

interface DailyPageProps {
  params: Promise<{ date: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: DailyPageProps): Promise<Metadata> {
  const { date } = await params;
  const entry = dailyArchiveEntry(date);
  if (!entry) return {};

  const formatted = formatArchiveDate(date);
  const playerFirst = playerFirstDaily(entry.number);
  const title = playerFirst ? `Daily Word Game #${entry.number}: ${formatted}` : `Daily Word Game #${entry.number}: ${entry.pair.a} and ${entry.pair.b}`;
  const description = playerFirst ? `Zonkey Daily #${entry.number} for ${formatted}: choose your opening word, reveal Zonkey's, and connect over five rounds in this daily word association game.` : `Zonkey Daily #${entry.number} for ${formatted}: connect ${entry.pair.a} and ${entry.pair.b} in this free word association game.`;

  return {
    title,
    description,
    alternates: { canonical: `/daily/${date}` },
    openGraph: {
      title: `${title} | Zonkey`,
      description,
      url: `/daily/${date}`,
      type: "article",
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
      title: `${title} | Zonkey`,
      description,
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function DailyPuzzlePage({ params }: DailyPageProps) {
  const { date } = await params;
  const entry = dailyArchiveEntry(date);
  if (!entry) notFound();

  const formatted = formatArchiveDate(date);
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const previousDate = new Date(dateMs - 86_400_000).toISOString().slice(0, 10);
  const nextDate = new Date(dateMs + 86_400_000).toISOString().slice(0, 10);
  const previous = dailyArchiveEntry(previousDate);
  const next = dailyArchiveEntry(nextDate);
  const playerFirst = playerFirstDaily(entry.number);
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: playerFirst ? `Zonkey Daily #${entry.number}: ${formatted}` : `Zonkey Daily #${entry.number}: ${entry.pair.a} and ${entry.pair.b}`,
    datePublished: date,
    dateModified: date,
    mainEntityOfPage: `https://zonkey.io/daily/${date}`,
    image: "https://zonkey.io/opengraph-image.png",
    author: {
      "@type": "Organization",
      name: "Zonkey",
      url: "https://zonkey.io",
    },
    description: `Five word association rounds in Zonkey Daily #${entry.number}.`,
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-6 sm:px-10 sm:py-10">
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
          href="/daily"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          All Daily puzzles
        </Link>
      </header>

      <article className="flex flex-1 flex-col justify-center py-12 text-center sm:py-20">
        <p className="eyebrow text-primary">Zonkey Daily #{entry.number}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.06em] sm:text-6xl">
          {formatted}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          {playerFirst ? "Choose your starting word. Reveal Zonkey’s preset word, then keep connecting until you meet in the middle." : "This puzzle gives everyone the same two starting words in the Daily word association game."}
        </p>

        {!playerFirst && <div className="daily-card relative isolate mx-auto mt-10 flex w-full max-w-xl items-center justify-center gap-4 overflow-hidden rounded-[2rem] border border-primary/25 bg-card p-8 sm:gap-8 sm:p-12">
          <strong className="relative z-10 min-w-0 flex-1 break-words text-3xl tracking-[-0.045em] sm:text-5xl">
            {entry.pair.a}
          </strong>
          <span className="relative z-10 text-2xl text-primary" aria-label="connects to">
            ↔
          </span>
          <strong className="relative z-10 min-w-0 flex-1 break-words text-3xl tracking-[-0.045em] sm:text-5xl">
            {entry.pair.b}
          </strong>
        </div>}

        <p className="mx-auto mt-8 max-w-lg text-sm leading-7 text-muted-foreground">
          {playerFirst ? "Everyone faces the same five opening words, kept hidden until you submit yours. Different words become your next pair. Your opening entry is guess one." : "Pick one word that connects both endpoints. Zonkey’s AI makes its own choice before the player submits. Different answers form the next pair."} Play five rounds with five guesses each, earning up to 1,000 points per round and 5,000 in total.
        </p>
        {!playerFirst && <ol className="mx-auto mt-5 w-full max-w-md divide-y rounded-xl border px-4 text-left text-sm">
          {dailyPairsForPuzzle(entry.number).map((pair, index) => (
            <li key={`${pair.a}:${pair.b}`} className="flex min-h-11 justify-between gap-3 py-3">
              <span className="text-muted-foreground">Round {index + 1}</span><span>{pair.a} + {pair.b}</span>
            </li>
          ))}
        </ol>}
        <Link
          href={`/?daily=${date}`}
          className="mx-auto mt-8 inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-bold text-primary-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--primary),var(--foreground)_15%)] focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Play Daily #{entry.number}
        </Link>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          Past puzzles are saved as archive practice. Your Daily streak counts puzzles finished on their original UTC day.
        </p>
      </article>

      <nav
        aria-label="Daily puzzle navigation"
        className="flex items-center justify-between gap-4 border-t py-6 text-sm"
      >
        {previous ? (
          <Link
            href={`/daily/${previous.date}`}
            className="text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            ← Daily #{previous.number}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/daily/${next.date}`}
            className="text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            Daily #{next.number} →
          </Link>
        ) : (
          <Link
            href="/daily"
            className="text-muted-foreground underline underline-offset-4 hover:text-primary"
          >
            Browse archive
          </Link>
        )}
      </nav>
      <JsonLd data={article} />
    </main>
  );
}
