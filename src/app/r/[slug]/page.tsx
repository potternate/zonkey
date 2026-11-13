import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dateForPuzzleNumber } from "@/lib/game/daily";
import { DAILY_MAX_SCORE } from "@/lib/game/daily-run";
import { decodeShareCard, shareCardTitle } from "@/lib/game/share-card";

interface ShareProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ShareProps): Promise<Metadata> {
  const { slug } = await params;
  const card = decodeShareCard(slug);
  if (!card) return {};
  const title = `${shareCardTitle(card)}: ${card.score.toLocaleString("en-US")} / ${DAILY_MAX_SCORE.toLocaleString("en-US")}`;
  const description = "Can you meet Zonkey in the middle? Play the free daily word association game.";
  const images = [{ url: `/r/${slug}/card`, width: 1200, height: 630, alt: title }];
  return {
    title: { absolute: title },
    description,
    robots: { index: false },
    openGraph: { title, description, url: `/r/${slug}`, siteName: "Zonkey", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images: images.map((image) => image.url) },
  };
}

export default async function SharePage({ params }: ShareProps) {
  const { slug } = await params;
  const card = decodeShareCard(slug);
  if (!card) notFound();
  const playHref = card.puzzleNumber === null ? "/" : `/?daily=${dateForPuzzleNumber(card.puzzleNumber)}`;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <Link href="/" className="glitch font-pixel text-2xl text-primary">ZONKEY</Link>
      <Image src={`/r/${slug}/card`} alt={`${shareCardTitle(card)} result card`} width={1200} height={630} unoptimized priority className="h-auto w-full border-2" />
      <p className="text-lg">Someone scored <span className="text-primary">{card.score.toLocaleString("en-US")}</span> on {shareCardTitle(card)}. Can you beat it?</p>
      <Button asChild className="h-auto min-h-16 w-full gap-3 px-4 py-3 text-[clamp(1.05rem,5vw,1.25rem)] leading-tight whitespace-normal">
        <Link href={playHref}>
          <span aria-hidden="true">▶</span>{card.puzzleNumber === null ? "Play Zonkey" : `Play Daily #${card.puzzleNumber}`}<span aria-hidden="true">◀</span>
        </Link>
      </Button>
    </main>
  );
}
