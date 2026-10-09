import { ChevronDown } from "lucide-react";
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
      "Enter your starting word to reveal Zonkey's preset word. If they differ, use that pair to choose a connection. For example, your donkey and the AI's zebra can both lead to Zonkey, a donkey–zebra hybrid. Different answers become the next pair until you match. Daily has five rounds, with five guesses per round including your opening word. Connecting sooner earns more points, up to 5,000 in total. Unlimited allows eight turns per game. Earlier Archive puzzles keep their original two-word openings.",
  },
  {
    question: "Is the Daily puzzle the same for everyone?",
    answer:
      "Yes. Every player faces the same five preset Daily opening words on the same UTC date, revealed after entering their own word. Later AI answers are shared whenever players reach the same pair at the same guess in a round. Finish all five rounds to compare your score with other players. Earlier puzzles keep their original shared starting pairs.",
  },
  {
    question: "Can I play more than once a day?",
    answer:
      "Yes. Daily is one shared puzzle each day, while Unlimited gives you as many random word association games as you want. You can also play past Dailies in the archive as practice.",
  },
  {
    question: "How do Daily streaks work?",
    answer:
      "Finish all five Daily rounds before midnight UTC on their original day to add to your streak. Any completed score counts, including zero. Yesterday's streak stays active while you have time to finish today's puzzle. Missing a day resets your current streak, but your best streak is saved. Previous on-time Daily completions still count. Archive practice does not change your streak.",
  },
  {
    question: "How do I play past Daily puzzles?",
    answer:
      "Choose Archive on the home page to open a calendar and a list of past Dailies. Play a date you haven't played, view your saved score for a completed puzzle, or resume an unfinished game. Scores stay with your anonymous identity in the same browser. Archive practice does not change your Daily streak.",
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
    "A free daily word association game with five rounds, five guesses per round, and scores up to 5,000 points.",
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
      <section aria-labelledby="zonkey-faq" className="mx-auto mt-10 w-full max-w-3xl border-y">
        <details className="group/faq">
          <summary className="flex min-h-14 list-none items-center justify-between gap-4 rounded-sm py-3 font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2">
            <span id="zonkey-faq">Zonkey FAQ</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/faq:rotate-180" aria-hidden="true" />
          </summary>
          <div className="divide-y border-t pb-2">
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
        </details>
      </section>

      <JsonLd data={videoGame} />
      <JsonLd data={faqPage} />
    </>
  );
}
