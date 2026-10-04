export interface DailyResults {
  distribution: { rounds: number; count: number }[];
  failed: number;
  totalPlayers: number;
  betterThanPercent: number | null;
}
