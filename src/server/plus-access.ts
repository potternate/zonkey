import "server-only";
import { toIsoDate } from "@/lib/game/daily";
import { dailyArchiveEntry } from "@/lib/game/archive";
import { hasPlusAccess } from "./account-store";
import { plusEnabled, requireUser } from "./auth";
import { GameError } from "./errors";
import { getStore } from "./store";
import { getDailyStore } from "./store/daily-index";

export async function assertPlusAccess(): Promise<void> {
  if (!plusEnabled()) return;
  const user = await requireUser();
  if (!await hasPlusAccess(user.id)) {
    throw new GameError("plus_required", "Unlock Unlimited and Archive for $5 once.");
  }
}

export async function assertDailyStartAccess(playerId: string, date?: string): Promise<void> {
  if (date === undefined || date === toIsoDate(new Date()) || !plusEnabled()) return;
  if (!dailyArchiveEntry(date)) throw new GameError("bad_request", "That puzzle is not available.");
  const saved = await getDailyStore().summary(playerId, toIsoDate(new Date()));
  if (saved.history.some((run) => run.date === date && run.status === "completed")) return;
  await assertPlusAccess();
}

export async function assertDailyAccess(playerId: string, id: string, playing = false): Promise<void> {
  const run = await getDailyStore().get(id);
  if (!run || run.playerId !== playerId) throw new GameError("not_found", "Game not found.");
  if (!playing && run.status === "completed") return;
  if (run.mode === "unlimited" || run.mode === "archive" || run.date !== toIsoDate(new Date())) await assertPlusAccess();
}

export async function assertGameAccess(playerId: string, id: string, playing = false): Promise<void> {
  const game = await getStore().getGame(id);
  if (!game || game.playerId !== playerId) throw new GameError("not_found", "Game not found.");
  if (!playing && game.status !== "active") return;
  if (game.mode !== "daily" || game.puzzleDate !== toIsoDate(new Date())) await assertPlusAccess();
}
