import Link from "next/link";
import { JsonLd } from "./json-ld";

const questions = [
  {
    question: "What is a word association game?",
    answer:
      "A word association game asks players to find a word that connects two ideas. In Zonkey, you and an AI independently choose a connection, then keep following the new words until your answers match.",
  },
  {
    question: "How do you play Zonkey?",
    answer:
      "Start with two words, enter one word that links them, and reveal the AI's answer. If the answers differ, they become the next pair. Connect in eight turns or fewer to win.",
  },
  {
    question: "Is the Daily puzzle the same for everyone?",
    answer:
      "Yes. Every player receives the same Daily starting pair on the same UTC date. Finish the puzzle to compare your turn count with other players.",
  },
  {
    question: "Can I play more than once a day?",
    answer:
      "Yes. Daily is one shared puzzle each day, while Unlimited gives you as many random word association games as you want.",
  },
  {
    question: "Is Zonkey free, and do I need an account?",
    answer:
      "Zonkey is free to play in your browser on a phone, tablet, or computer. No account is required, and your scores are saved with an anonymous player identity.",
  },
] as const;

const videoGame = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Zonkey",
  url: "https://zonkey.io",
  image: "https://zonkey.io/opengraph-image.png",
  description:
    "A free daily word association game where you connect two words with an AI in eight turns or fewer.",
  applicationCategory: "Game",
  applicationSubCategory: "Word game",
  gamePlatform: "Web browser",
  operatingSystem: "Any",
  playMode: "https://schema.org/SinglePlayer",
  numberOfPlayers: {
    "@type": "QuantitativeValue",
    value: 1,
  },
  isAccessibleForFree: true,
  inLanguage: "en",
  genre: ["Word game", "Puzzle game"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export function HomeSeoContent() {
  return (
    <>
      <section
        aria-labelledby="how-to-play-zonkey"
        className="mt-14 border-t py-14 sm:mt-20 sm:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow text-primary">Daily word association game</p>
            <h2
              id="how-to-play-zonkey"
              className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl"
            >
              How to play Zonkey
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
              Find the word that connects two starting ideas. Zonkey&rsquo;s AI
              locks in its answer before you submit, without seeing your guess.
              Different answers become the next pair, and a matching idea wins.
            </p>
            <Link
              href="/daily"
              className="mt-6 inline-flex min-h-11 items-center rounded-lg font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Browse the Daily puzzle archive
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ["1", "Connect the pair", "Enter one common word that links both starting words."],
              ["2", "Reveal together", "See your answer and the AI answer at the same time."],
              ["3", "Find the match", "Follow each new pair and connect within eight turns."],
            ].map(([number, title, copy]) => (
              <li key={number} className="rounded-2xl border bg-card p-5">
                <span className="eyebrow text-primary">{number.padStart(2, "0")}</span>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="zonkey-faq" className="border-t py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow text-center text-primary">Questions, connected</p>
          <h2
            id="zonkey-faq"
            className="mt-3 text-center text-3xl font-bold tracking-[-0.045em]"
          >
            Zonkey FAQ
          </h2>
          <div className="mt-8 divide-y rounded-2xl border bg-card px-5 sm:px-7">
            {questions.map(({ question, answer }) => (
              <details key={question} className="group py-5">
                <summary className="flex min-h-11 list-none items-center justify-between gap-4 font-semibold marker:hidden">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-xl text-primary transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-2 pr-8 text-sm leading-7 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <JsonLd data={videoGame} />
      <JsonLd data={faqPage} />
    </>
  );
}
