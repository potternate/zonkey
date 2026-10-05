import { getStore } from "./store";
import type { AnalyticsEvent } from "./store/types";

export const ANALYTICS_EVENTS = [
  "game_started",
  "answer_submitted",
  "round_completed",
  "game_won",
  "game_lost",
  "share_clicked",
  "daily_started",
  "daily_guess_submitted",
  "daily_round_completed",
  "daily_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Fire-and-forget: analytics must never break gameplay. */
export async function track(event: AnalyticsEvent & { name: AnalyticsEventName }): Promise<void> {
  try {
    await getStore().insertEvent(event);
  } catch (err) {
    console.error("[zonkey] analytics failed", event.name, err);
  }
}
