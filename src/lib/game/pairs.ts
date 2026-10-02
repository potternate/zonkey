import type { StartingPair } from "./types";

/**
 * Starting endpoints. Daily puzzles walk this list in order (see daily.ts), so
 * append new pairs at the end to keep past puzzle numbers stable.
 */
export const STARTING_PAIRS: readonly StartingPair[] = [
  { a: "pizza", b: "ocean", emojiA: "🍕", emojiB: "🌊" },
  { a: "dog", b: "moon", emojiA: "🐶", emojiB: "🌙" },
  { a: "coffee", b: "rain", emojiA: "☕", emojiB: "🌧️" },
  { a: "guitar", b: "fire", emojiA: "🎸", emojiB: "🔥" },
  { a: "apple", b: "school", emojiA: "🍎", emojiB: "🏫" },
  { a: "snow", b: "cake", emojiA: "❄️", emojiB: "🎂" },
  { a: "train", b: "bird", emojiA: "🚆", emojiB: "🐦" },
  { a: "book", b: "night", emojiA: "📖", emojiB: "🌃" },
  { a: "rocket", b: "garden", emojiA: "🚀", emojiB: "🌷" },
  { a: "cheese", b: "mountain", emojiA: "🧀", emojiB: "⛰️" },
  { a: "phone", b: "ghost", emojiA: "📱", emojiB: "👻" },
  { a: "candle", b: "river", emojiA: "🕯️", emojiB: "🏞️" },
  { a: "lemon", b: "car", emojiA: "🍋", emojiB: "🚗" },
  { a: "crown", b: "egg", emojiA: "👑", emojiB: "🥚" },
  { a: "bee", b: "clock", emojiA: "🐝", emojiB: "⏰" },
  { a: "hat", b: "star", emojiA: "🎩", emojiB: "⭐" },
  { a: "bread", b: "storm", emojiA: "🍞", emojiB: "⛈️" },
  { a: "key", b: "whale", emojiA: "🔑", emojiB: "🐋" },
  { a: "shoe", b: "sun", emojiA: "👟", emojiB: "☀️" },
  { a: "chocolate", b: "bridge", emojiA: "🍫", emojiB: "🌉" },
  { a: "cat", b: "music", emojiA: "🐱", emojiB: "🎵" },
  { a: "tree", b: "money", emojiA: "🌳", emojiB: "💰" },
  { a: "ice", b: "dragon", emojiA: "🧊", emojiB: "🐉" },
  { a: "pencil", b: "island", emojiA: "✏️", emojiB: "🏝️" },
  { a: "honey", b: "castle", emojiA: "🍯", emojiB: "🏰" },
  { a: "balloon", b: "fish", emojiA: "🎈", emojiB: "🐟" },
  { a: "window", b: "banana", emojiA: "🪟", emojiB: "🍌" },
  { a: "bell", b: "cloud", emojiA: "🔔", emojiB: "☁️" },
  { a: "tea", b: "lion", emojiA: "🍵", emojiB: "🦁" },
  { a: "camera", b: "forest", emojiA: "📷", emojiB: "🌲" },
  { a: "bicycle", b: "popcorn", emojiA: "🚲", emojiB: "🍿" },
  { a: "rose", b: "computer", emojiA: "🌹", emojiB: "💻" },
];

const UNKNOWN_EMOJI = "⬜";

export function findStartingPair(a: string, b: string): StartingPair {
  return (
    STARTING_PAIRS.find((p) => p.a === a && p.b === b) ?? {
      a,
      b,
      emojiA: UNKNOWN_EMOJI,
      emojiB: UNKNOWN_EMOJI,
    }
  );
}

export function randomStartingPair(random: () => number = Math.random): StartingPair {
  return STARTING_PAIRS[Math.floor(random() * STARTING_PAIRS.length)];
}
