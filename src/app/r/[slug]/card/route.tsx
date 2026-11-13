import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { zebraSvgMarkup } from "@/components/game/pixel-scene";
import { DAILY_MAX_SCORE } from "@/lib/game/daily-run";
import { decodeShareCard, type ShareCell } from "@/lib/game/share-card";

const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/PressStart2P-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/VT323-Regular.ttf")),
]);

const CELL: Record<ShareCell, { background: string; border: string }> = {
  hit: { background: "#6ff0a8", border: "#2f7a3e" },
  miss: { background: "#3d2b66", border: "#5b4790" },
  none: { background: "#1e1336", border: "#2c1f4a" },
};

const zebra = `data:image/svg+xml,${encodeURIComponent(zebraSvgMarkup())}`;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const card = decodeShareCard((await params).slug);
  if (!card) return new Response("Not found", { status: 404 });
  const [pixel, vt323] = await fonts;
  const label = card.puzzleNumber === null ? "UNLIMITED" : `DAILY #${card.puzzleNumber}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px 0", background: "linear-gradient(180deg, #2a1450 0%, #1a0d2e 55%, #12081a 100%)", fontFamily: "VT323", color: "#fbf3e6", border: "10px solid #3d2b66", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "PressStart", fontSize: 64, color: "#ffb648", textShadow: "-5px 0 #ff3d6e, 5px 0 #4de3ff" }}>ZONKEY</div>
          <div style={{ fontSize: 52, color: "#c9b8e8", letterSpacing: 6 }}>{label}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "PressStart", fontSize: 100 }}>{card.score.toLocaleString("en-US")}</div>
            <div style={{ fontSize: 48, color: "#a99bc7", letterSpacing: 6, marginTop: 16 }}>{`/ ${DAILY_MAX_SCORE.toLocaleString("en-US")} PTS`}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {card.grid.map((row, r) => (
              <div key={r} style={{ display: "flex", gap: 14 }}>
                {row.map((cell, g) => <div key={g} style={{ width: 60, height: 60, background: CELL[cell].background, border: `6px solid ${CELL[cell].border}` }} />)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 150 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 44, color: "#ffb648", letterSpacing: 4, marginBottom: 36 }}><span>CAN YOU MEET ZONKEY IN THE MIDDLE?</span><span style={{ color: "#c9b8e8" }}>ZONKEY.IO</span></div>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser */}
          <img src={zebra} width={162} height={117} alt="" style={{ marginBottom: 20 }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 24, background: "#2a1436", display: "flex" }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "PressStart", data: pixel, style: "normal", weight: 400 },
        { name: "VT323", data: vt323, style: "normal", weight: 400 },
      ],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
