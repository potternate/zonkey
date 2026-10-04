import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  dailyArchiveEntry,
  formatArchiveDate,
} from "@/lib/game/archive";
import { JsonLd } from "@/components/seo/json-ld";

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
  const title = `Daily Word Game #${entry.number}: ${entry.pair.a} and ${entry.pair.b}`;
  const description = `Zonkey Daily #${entry.number} for ${formatted}: connect ${entry.pair.a} and ${entry.pair.b} in this free word association game.`;

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
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Zonkey Daily #${entry.number}: ${entry.pair.a} and ${entry.pair.b}`,
    datePublished: date,
    dateModified: date,
    mainEntityOfPage: `https://zonkey.io/daily/${date}`,
    image: "https://zonkey.io/opengraph-image.png",
    author: {
      "@type": "Organization",
      name: "Zonkey",
      url: "https://zonkey.io",
    },
    description: `The starting pair for Zonkey Daily #${entry.number}, the free daily word association game.`,
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-6 sm:px-10 sm:py-10">
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
          This puzzle gives everyone the same two starting words in the Daily
          word association game.
        </p>

        <div className="daily-card relative isolate mx-auto mt-10 flex w-full max-w-xl items-center justify-center gap-4 overflow-hidden rounded-[2rem] border border-primary/25 bg-card p-8 sm:gap-8 sm:p-12">
          <strong className="relative z-10 min-w-0 flex-1 break-words text-3xl tracking-[-0.045em] sm:text-5xl">
            {entry.pair.a}
          </strong>
          <span className="relative z-10 text-2xl text-primary" aria-label="connects to">
            ↔
          </span>
          <strong className="relative z-10 min-w-0 flex-1 break-words text-3xl tracking-[-0.045em] sm:text-5xl">
            {entry.pair.b}
          </strong>
        </div>

        <p className="mx-auto mt-8 max-w-lg text-sm leading-7 text-muted-foreground">
          Pick one word that connects both endpoints. Zonkey&rsquo;s AI makes
          its own choice before the player submits. Different answers form the
          next pair, and matching ideas connect in eight turns or fewer.
        </p>
        <Link
          href="/"
          className="mx-auto mt-8 inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-bold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Play today&rsquo;s free Daily
        </Link>
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
