import type { StartingPair } from "./types";

export const CURATED_DAILY_FROM = 11;
export type PairDifficulty = "gentle" | "medium" | "tricky";

function pairs(text: string): StartingPair[] {
  return text.trim().split("\n").map((line) => {
    const [a, b] = line.trim().split(/\s+/);
    return { a, b, emojiA: "⬜", emojiB: "⬜" };
  });
}

export const CURATED_PAIRS: Record<PairDifficulty, readonly StartingPair[]> = {
  gentle: pairs(`
    dog bone
    bee flower
    bird tree
    cat yarn
    horse saddle
    fish pond
    spider fly
    chicken egg
    bread oven
    cheese milk
    cake candle
    lemon tea
    apple pie
    coffee morning
    popcorn cinema
    tomato pasta
    sand ocean
    rain cloud
    snow mountain
    sun flower
    tree paper
    river boat
    fire wood
    moon night
    guitar song
    pencil school
    book library
    shoe foot
    clock alarm
    key door
    camera photo
    train station
  `),
  medium: pairs(`
    turtle helmet
    owl moon
    dolphin whistle
    rabbit carrot
    bear honey
    butterfly rainbow
    squirrel pantry
    penguin tuxedo
    mint winter
    mushroom umbrella
    onion tear
    watermelon summer
    noodle ribbon
    pancake blanket
    honey gold
    pepper dragon
    cactus camel
    forest cathedral
    river ribbon
    ocean mirror
    mountain ladder
    cloud pillow
    leaf sail
    cave echo
    music ocean
    clock river
    lantern star
    book voyage
    bridge handshake
    bicycle balance
    compass question
    garden patience
  `),
  tricky: pairs(`
    zebra piano
    donkey horse
    octopus juggler
    chameleon actor
    peacock painter
    ant city
    moth lantern
    whale orchestra
    chocolate volcano
    onion curtain
    lemon battery
    cinnamon forest
    bread sponge
    coffee engine
    cherry sunset
    waffle window
    desert hourglass
    glacier memory
    rain applause
    tree family
    moon pearl
    mountain crown
    river sentence
    ocean quilt
    clock heartbeat
    mirror lake
    keyboard orchestra
    maze question
    bicycle butterfly
    anchor promise
    telescope dream
    book seed
  `),
};

export function curatedDailyExtras(number: number, first: StartingPair): StartingPair[] {
  const seen = new Set([[first.a, first.b].sort().join("|")]);
  return (["gentle", "medium", "gentle", "tricky"] as const).map((difficulty, index) => {
    const pool = CURATED_PAIRS[difficulty];
    let offset = (number * 17 + index * 7) % pool.length;
    while (seen.has([pool[offset].a, pool[offset].b].sort().join("|"))) offset = (offset + 1) % pool.length;
    const pair = pool[offset];
    seen.add([pair.a, pair.b].sort().join("|"));
    return pair;
  });
}
