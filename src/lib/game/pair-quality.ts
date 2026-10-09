export interface PairObservation {
  a: string;
  b: string;
  mode: string;
  status: "active" | "won" | "lost";
  guesses: number;
  firstGuessMatched: boolean;
  updatedAt: string;
}

export function pairQuality(observations: PairObservation[], now = new Date()) {
  const groups = new Map<string, PairObservation[]>();
  for (const observation of observations) {
    const key = `${observation.mode}:${[observation.a, observation.b].sort().join("|")}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const completed = group.filter((row) => row.status !== "active");
    const solved = completed.filter((row) => row.status === "won");
    const stale = group.filter((row) => row.status === "active" && now.getTime() - Date.parse(row.updatedAt) >= 86_400_000);
    const firstGuesses = group.filter((row) => row.guesses > 0);
    const solveRate = completed.length ? solved.length / completed.length : null;
    const firstGuessRate = firstGuesses.length ? firstGuesses.filter((row) => row.firstGuessMatched).length / firstGuesses.length : null;
    const flags: string[] = [];
    if (completed.length >= 20 && solveRate !== null && solveRate < 0.3) flags.push("often unsolved");
    if (firstGuesses.length >= 20 && firstGuessRate !== null && firstGuessRate > 0.8) flags.push("often immediate");
    if (group.length >= 20 && stale.length / group.length > 0.4) flags.push("often left unfinished");
    return {
      pair: [group[0].a, group[0].b].sort().join(" + "),
      mode: group[0].mode,
      started: group.length,
      completed: completed.length,
      solved: solved.length,
      solvePercent: solveRate === null ? null : Math.round(solveRate * 100),
      firstGuessPercent: firstGuessRate === null ? null : Math.round(firstGuessRate * 100),
      averageSolvedGuesses: solved.length ? Math.round(solved.reduce((sum, row) => sum + row.guesses, 0) / solved.length * 10) / 10 : null,
      staleUnfinished: stale.length,
      flags,
      sample: completed.length < 20 ? "insufficient" : "reviewable",
    };
  }).sort((a, b) => b.flags.length - a.flags.length || b.started - a.started || a.pair.localeCompare(b.pair));
}
