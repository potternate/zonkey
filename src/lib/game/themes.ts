import type { StartingPair } from "./types";

export const UNLIMITED_THEMES = ["animals", "food", "outdoors"] as const;
export type UnlimitedTheme = typeof UNLIMITED_THEMES[number];
export const THEME_LABELS: Record<UnlimitedTheme, string> = {
  animals: "Animals", food: "Food", outdoors: "Outdoors",
};

function pairs(text: string): StartingPair[] {
  return text.trim().split("\n").map((line) => {
    const [a, b] = line.trim().split(/\s+/);
    return { a, b, emojiA: "⬜", emojiB: "⬜" };
  });
}

export const THEMED_PAIRS: Record<UnlimitedTheme, readonly StartingPair[]> = {
  animals: pairs(`
    zebra donkey
    wolf dog
    cat lion
    horse camel
    penguin seal
    dolphin whale
    owl bat
    eagle falcon
    rabbit hare
    bear squirrel
    fox raccoon
    turtle snail
    frog fish
    butterfly moth
    bee ant
    spider octopus
    giraffe ostrich
    elephant rhinoceros
    shark crocodile
    parrot monkey
    tiger leopard
    deer moose
    otter beaver
    duck swan
  `),
  food: pairs(`
    bread cheese
    apple cinnamon
    lemon honey
    coffee chocolate
    tomato basil
    potato onion
    rice bean
    pasta mushroom
    peach cream
    banana coconut
    carrot ginger
    butter garlic
    chili lime
    peanut caramel
    almond cherry
    corn pepper
    pumpkin nutmeg
    strawberry vanilla
    cucumber mint
    mango pineapple
    olive rosemary
    spinach egg
    blueberry pancake
    oat yogurt
  `),
  outdoors: pairs(`
    river mountain
    forest ocean
    sand wind
    cactus sun
    snow pine
    rain leaf
    lake meadow
    cloud cliff
    cave waterfall
    beach shell
    trail valley
    canyon stone
    glacier stream
    moss bark
    desert oasis
    thunder rainbow
    dawn horizon
    moon tide
    garden spring
    volcano island
    breeze grass
    creek pebble
    dune ridge
    summit sky
  `),
};

export function randomThemedPair(theme: UnlimitedTheme, random = Math.random): StartingPair {
  const pool = THEMED_PAIRS[theme];
  return pool[Math.floor(random() * pool.length)];
}
