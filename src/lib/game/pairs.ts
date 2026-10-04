import type { StartingPair } from "./types";

/**
 * The original rotation. Keep the order stable so already-played Daily
 * puzzles always resolve to the same endpoints.
 */
export const LEGACY_STARTING_PAIRS: readonly StartingPair[] = [
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
const PAIR_OFFSETS = [97, 193, 307, 421, 557, 691, 809, 953] as const;

/** Append words at the end; the Daily schedule depends on this order. */
const CURATED_STARTER_WORDS = `
aardvark albatross alligator alpaca ant anteater antelope ape armadillo badger
bat bear beaver bee beetle bison boar bobcat buffalo butterfly camel canary
capybara caribou cat caterpillar cheetah chicken chimpanzee chipmunk cobra
cockatoo cod cougar cow coyote crab crane cricket crocodile crow deer dingo
dolphin donkey dove dragonfly duck eagle eel elephant elk falcon ferret finch
firefly flamingo fly fox frog gazelle gecko gerbil giraffe goat goldfish goose
gorilla grasshopper hamster hare hawk hedgehog heron hippo hornet horse
hummingbird hyena iguana jackal jaguar jellyfish kangaroo koala ladybug lamb
lemur leopard lion lizard llama lobster lynx macaw magpie manatee mole monkey
moose mosquito moth mouse mule octopus opossum ostrich otter owl ox oyster
panda panther parrot peacock pelican penguin pig pigeon pony porcupine rabbit
raccoon ram rat raven reindeer rhino robin rooster salmon scorpion seal shark
sheep skunk sloth snail snake sparrow spider squid squirrel starfish stork
swan tadpole tiger toad trout turkey turtle walrus wasp weasel whale wolf
wombat woodpecker yak zebra
apple apricot avocado bagel banana basil bean beef berry biscuit blueberry
bread broccoli brownie burger burrito butter cabbage cake candy caramel carrot
cashew celery cereal cheese cherry chickpea chili chocolate cinnamon coconut
cookie corn cracker cranberry cream croissant cucumber cupcake curry date
donut dumpling egg eggplant fig flour garlic ginger grape grapefruit gravy
guava ham hazelnut honey jam jelly kiwi lemon lentil lettuce lime mango maple
marshmallow melon milk mint muffin mushroom mustard noodle nut oatmeal olive
onion orange pancake pasta peach peanut pear pea pepper pickle pie pineapple
pistachio plum popcorn potato pretzel pumpkin radish raisin raspberry rice
rosemary salad salsa sandwich sausage spinach strawberry sugar sushi syrup
taco tangerine toast tofu tomato tortilla tuna vanilla vinegar waffle walnut
watermelon yogurt
coffee cola cocoa espresso juice lemonade milkshake punch smoothie soda tea
water cider broth soup
acorn algae bamboo bark blossom branch bush cactus clover daisy fern flower
forest garden grass herb ivy jungle leaf lily moss orchid palm petal pine
plant pollen poppy reed root rose seed shrub sunflower thorn tree tulip vine
weed willow wood
ash avalanche beach boulder canyon cave cliff coast crystal desert diamond
dirt dune dust earth field glacier gravel hill island lava meadow mineral mud
oasis pebble pond prairie reef river rock sand sea shell shore soil stone
swamp valley volcano waterfall wave
air autumn breeze cloud cold cyclone dawn dew drought eclipse fog frost hail
heat hurricane ice lightning mist moon night rainbow rain shadow sky snow
spring star storm summer sun sunset thunder tornado weather wind winter
airport alley apartment attic bakery balcony bank barn basement bathroom
bedroom bridge cabin cafe castle cellar church cinema city classroom clinic
clubhouse cottage courthouse dock farm garage garden gate greenhouse harbor
hospital hotel house hut kitchen laboratory library lighthouse mall market
museum office palace park patio playground porch prison restaurant road school
shop stadium station street studio temple theater tower town tunnel village
warehouse yard
ambulance bicycle boat bus canoe car cart ferry helicopter jet kayak motorcycle
plane raft rocket scooter ship sled subway taxi tractor train tram truck van
wagon yacht
anchor arrow axe backpack bag ball balloon basket battery bead bell belt bench
blanket block board bottle bowl box bracelet brick broom bucket button cable
camera candle card carpet chain chair chalk charger clock coin comb compass
cord crown cup curtain cushion desk dice dish doll door drill drum envelope fan
feather fence flag flashlight fork frame glass glove glue hammer hanger helmet
hook hose jar jewel key kite knife ladder lamp lantern lid lock magnet map
mask mat mirror nail needle net notebook paddle paint paper pencil pillow pin
plate pliers pocket poster pot puzzle radio rake ribbon ring rope ruler saddle
saw scarf scissors screw shelf shovel sign skateboard soap sock spoon stamp
stapler stick suitcase table tent thread ticket tire tool toothbrush towel toy
tray trophy umbrella vase wallet watch wheel whistle window wire zipper
bed book calendar couch dictionary doorbell drawer fireplace fridge kettle
mattress oven pantry pillowcase shower sink sofa stove teapot toaster toilet
vacuum wardrobe
blender calculator computer controller drone earbuds keyboard laptop microphone
monitor mousepad printer robot router screen speaker tablet telephone television
thermostat tripod typewriter webcam
accordion banjo cello clarinet flute guitar harmonica harp horn organ piano
saxophone trumpet violin
album art ballet cartoon chorus comedy concert dance drawing film melody music
opera painting photo poem portrait rhythm sculpture song story
archery badminton baseball basketball bowling boxing cricket football golf
gymnastics hockey karate racing rugby running sailing skiing soccer softball
surfing swimming tennis volleyball wrestling
actor artist athlete baker barber builder captain chef coach dancer dentist
doctor driver farmer firefighter gardener guard judge lawyer librarian mechanic
musician nurse painter pilot plumber poet police sailor scientist singer
soldier teacher vet waiter writer
baby brother child cousin daughter family father friend grandmother grandfather
guest hero king mother neighbor parent partner prince queen sister stranger
student uncle
ankle arm back beard blood bone brain cheek chin ear elbow eye face finger
foot hair hand heart heel knee leg lip lung mouth muscle neck nose shoulder
skin smile stomach teeth thumb toe tongue tooth
apron boot bracelet cap coat costume dress earring glasses gown hat jacket
jeans mitten necklace pajamas pants purse raincoat sandal shirt shoe shorts
skirt slipper sneaker suit sweater tie uniform vest
circle cone cube curve cylinder diamond dot edge hexagon line oval point
pyramid rectangle sphere spiral square star triangle
amber aqua beige black blue bronze brown coral crimson cyan gold gray green
indigo ivory lavender lime magenta maroon navy orange pink purple red silver
tan teal turquoise violet white yellow
alarm alphabet answer birthday break breakfast camp carnival class
college contest dinner dream exam exercise feast festival game gift holiday
homework journey lesson lunch meeting parade party picnic question recess
schoolwork sleep test trip vacation wedding
april august century day decade evening february friday hour january july june
march may minute monday month morning november october saturday second september
sunday thursday time today tomorrow tuesday wednesday week weekend year
adventure balance beauty bravery calm chance change choice comfort courage
curiosity danger energy faith fame fear freedom fun future grace happiness
health hope humor idea imagination joy justice kindness knowledge luck memory
peace power pride problem promise reason respect safety secret strength surprise
talent trust truth victory wisdom wonder
anger boredom delight excitement grief jealousy love panic patience pleasure
sadness shame stress worry
beginning center corner direction east end front inside left middle north
outside right side south top west
arrival birth connection discovery escape finish goal growth help invitation
match mystery plan race rest return start success travel visit work
bang buzz cheer clap crack echo hum laugh noise pop purr roar scream silence
snap song splash thunder whisper whistle
bright clean clear cool dark deep dry empty fast fresh full gentle hard heavy
high hot huge light little loud low new old quiet rough round sharp shiny
short slow small smooth soft solid sweet tall thick thin tiny warm wet wild
young
autumn beach birthday breakfast bridge bubble campfire candle castle chocolate
coffee comet compass cookie crown dance diamond dinosaur dragon dream feather
fire flower forest friend galaxy garden ghost giant guitar heart honey island
jungle kite lemon magic magnet maze mermaid monster mountain music ocean pirate
pizza planet rainbow river robot rocket sandwich shadow snow spaceship treasure
unicorn waterfall wizard
antique armor barrel beacon boot camp cannon cape cave cowboy desert explorer
fort gold map mine ranch saloon sheriff shield sword trail wagon
angel bell candle carol chimney elf fireplace gift holly ornament reindeer
ribbon sleigh stocking wreath
bat broom cauldron costume ghost mask moon mummy pumpkin skeleton spider vampire
witch zombie
beaker bubble chemical flask formula laser machine microscope molecule science
telescope experiment
asteroid comet earth galaxy gravity mars mercury meteor neptune orbit planet
pluto saturn space spaceship universe venus
browser button code cursor database download email file folder internet link
message network password pixel search server signal software website wifi
article chapter cover diary library magazine newspaper novel page paragraph
story title word
cash cent check coin credit dollar fortune money penny price sale treasure
bank beach capital city country county district flag globe map nation state
border
court crime clue detective evidence law mystery police prison suspect trial
ache bandage cure fever health medicine pill remedy sick vitamin
barber brush comb haircut mirror razor shampoo
bakery bread dough flour oven pastry
farm barn crop fence field hay tractor
aquarium fish glass reef tank water
campfire forest lake marsh mountain river tent trail
card checkers chess dice domino puzzle
bubble chalk crayon marble playground swing
auction bargain basket checkout coupon market package parcel store
clock calendar deadline schedule stopwatch timer
cloud computer disk file memory mouse printer screen
door gate key lock wall window
fire flame heat match smoke spark
fountain lake ocean pool rain river stream
bird feather nest sky wing
bee flower hive honey queen
book ink library page paper pen
camera film flash lens photo
car engine fuel road tire wheel
cake candle party sugar wish
circus clown ring tent trapeze
crown king palace prince queen throne
doctor clinic hospital medicine nurse
garden flower grass seed soil
guitar band music song string
island beach boat palm sand
lemon sour tea yellow zest
moon night orbit sky star
mountain climb peak rock snow
phone call message ring signal
rainbow cloud color rain sky
school book class pencil teacher
ship anchor captain ocean sail
shoe foot lace sock walk
train rail station ticket travel
computer code keyboard screen software
dragon fire legend scale wing
ghost dark haunt night spirit
lion jungle mane roar pride
clock alarm hour minute time
`;

function uniqueWords(words: string): string[] {
  return [...new Set(words.trim().split(/\s+/))];
}

const legacyWords = LEGACY_STARTING_PAIRS.flatMap(({ a, b }) => [a, b]);

/** Common one-word endpoints used to build the large shared pair rotation. */
export const STARTING_WORDS: readonly string[] = uniqueWords(
  `${legacyWords.join(" ")} ${CURATED_STARTER_WORDS}`,
);

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildStartingPairs(): StartingPair[] {
  const pairs = [...LEGACY_STARTING_PAIRS];
  const seen = new Set(pairs.map(({ a, b }) => pairKey(a, b)));

  for (let index = 0; index < STARTING_WORDS.length; index += 1) {
    for (const offset of PAIR_OFFSETS) {
      if (index < offset) continue;
      const a = STARTING_WORDS[index - offset];
      const b = STARTING_WORDS[index];
      const key = pairKey(a, b);
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a, b, emojiA: UNKNOWN_EMOJI, emojiB: UNKNOWN_EMOJI });
    }
  }

  return pairs;
}

/**
 * Daily walks this list in order and Unlimited samples it randomly. The
 * original 32 pairs stay first; generated pairs follow in a stable order.
 */
export const STARTING_PAIRS: readonly StartingPair[] = buildStartingPairs();
const STARTING_PAIR_BY_KEY = new Map(
  STARTING_PAIRS.map((pair) => [`${pair.a}|${pair.b}`, pair]),
);

export function findStartingPair(a: string, b: string): StartingPair {
  return (
    STARTING_PAIR_BY_KEY.get(`${a}|${b}`) ?? {
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
