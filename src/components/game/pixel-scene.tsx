import { cn } from "@/lib/utils";

const W = 128;
const H = 64;
const HORIZON = 40;

const SKY = [
  [0, "#1f1440"], [9, "#351a55"], [17, "#5a2266"], [23, "#8a2c6c"],
  [28, "#c23f69"], [32, "#ea6a55"], [35, "#f7a04f"], [38, "#fcc96a"],
] as const;

const STARS = [[6, 3], [19, 7], [31, 2], [44, 10], [58, 4], [73, 8], [88, 3], [101, 11], [114, 5], [123, 9], [12, 14], [95, 15]];

const ZEBRA = [
  "...B..............",
  "..BWB.............",
  ".BWWWB............",
  "BWWBWWB...........",
  "WWWWBWWBBBBBBBBB..",
  "BW..BWWBWWBWWBWWB.",
  "....BWWBWWBWWBWWWB",
  "....BWWBWWBWWBWWB.",
  "....BWWBWWBWWBWWB.",
  ".....B.W.....B.W..",
  ".....W.B.....W.B..",
  ".....B.W.....B.W..",
  ".....B.B.....B.B..",
];

function pixels(points: Iterable<[number, number]>): string {
  let d = "";
  for (const [x, y] of points) d += `M${x} ${y}h1v1h-1z`;
  return d;
}

function* dither(y: number): Generator<[number, number]> {
  for (let x = 0; x < W; x += 2) yield [x + (y % 2), y];
}

function* sprite(rows: string[], ox: number, oy: number, tone: string): Generator<[number, number]> {
  for (const [y, row] of rows.entries()) {
    for (const [x, cell] of [...row].entries()) if (cell === tone) yield [ox + x, oy + y];
  }
}

function ridge(heights: number[], step: number): string {
  let d = `M0 ${H}`;
  heights.forEach((h, i) => { d += `V${h}H${Math.min(W, (i + 1) * step)}`; });
  return `${d}V${H}Z`;
}

const sun = Array.from({ length: 15 }, (_, i) => {
  const dy = i - 14;
  const half = Math.floor(Math.sqrt(14 * 14 - dy * dy));
  return { y: 26 + i, x: 64 - half, w: half * 2 };
}).filter(({ y }) => ![33, 36, 38].includes(y));

export function PixelScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("pixelated block w-full", className)}
    >
      {SKY.map(([y, color], i) => (
        <rect key={y} x="0" y={y} width={W} height={(SKY[i + 1]?.[0] ?? HORIZON) - y} fill={color} />
      ))}
      {SKY.slice(1).map(([y, color]) => <path key={y} d={pixels(dither(y - 1))} fill={color} />)}
      {STARS.map(([x, y], i) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#fff6e0" className="animate-twinkle" style={{ animationDelay: `${(i % 4) * 0.6}s` }} />
      ))}
      {sun.map(({ x, y, w }) => <rect key={y} x={x} y={y} width={w} height="1" fill={y < 33 ? "#ffe58a" : "#ffb04f"} />)}
      <path d="M16 20h12v1H16zM12 21h22v1H12zM20 19h5v1h-5zM92 25h16v1H92zM88 26h26v1H88zM96 24h7v1h-7z" fill="#e07a8a" opacity="0.8" />
      <path d={ridge([36, 35, 34, 34, 36, 37, 38, 38, 37, 36, 35, 36, 38, 38, 37, 36], 8)} fill="#4b1f4f" />
      <path d={ridge([46, 45, 44, 44, 44, 45, 46, 47, 47, 46, 45, 44, 44, 45, 46, 46, 47, 48, 48, 47, 46, 46, 47, 47, 48, 48, 47, 46, 45, 45, 46, 47], 4)} fill="#2a1436" />
      <rect x="0" y="52" width={W} height="12" fill="#1a0d24" />
      <path d={pixels(Array.from({ length: 20 }, (_, i) => [(i * 37) % W, 54 + ((i * 7) % 9)] as [number, number]))} fill="#3a1d44" />
      <path d="M20 31h2v14h-2zM16 33h2v1h1v1h1v1h-2v-1h-1v-1h-1zM25 33h2v1h-1v1h-1v1h-2v-1h1v-1h1zM14 28h16v2H14zM10 30h24v2H10zM8 32h8v1H8zM28 32h8v1h-8zM18 26h8v2h-8z" fill="#12081a" />
      <path d={pixels(sprite(ZEBRA, 82, 32, "W"))} fill="#fbf3e6" />
      <path d={pixels(sprite(ZEBRA, 82, 32, "B"))} fill="#12081a" />
    </svg>
  );
}

export function PixelZebra({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 13" shapeRendering="crispEdges" aria-hidden="true" className={cn("pixelated block", className)}>
      <path d={pixels(sprite(ZEBRA, 0, 0, "W"))} fill="#fbf3e6" />
      <path d={pixels(sprite(ZEBRA, 0, 0, "B"))} fill="#12081a" />
    </svg>
  );
}
