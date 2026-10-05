# Zonkey

zonkey.io

**Two words. One wild match.** A mobile-first daily word-convergence game against an AI.

You and the AI each pick a word connecting two endpoints. Different words become the next round's endpoints; matching words win. From round 2 onward, equivalent meanings also connect. Max 8 rounds.

Choose **Daily** for one free shared puzzle each UTC day, or **Unlimited** for as many random starting pairs as you want. The pool has 1,365 unique starter words and 6,924 distinct pairs for both modes. **Your Scores** keeps Daily and Unlimited results separate, with games played, win percentage, best round count, average winning rounds, and recent results.

Daily streaks count consecutive UTC days where the player finishes that day's puzzle before midnight. Wins and losses both count. A streak ending yesterday remains current until today's deadline; missing a day resets the current streak while preserving the best. Existing on-time completions count automatically. Home, Daily results, and Daily scores show both current and best streaks.

**Archive** is the third mode beside Daily and Unlimited. It opens a month calendar with a list of that month's past puzzles underneath. Unplayed dates can be played; completed dates show the saved score and reopen the result; unfinished dates resume their saved game. Original Daily results appear alongside archive attempts, including games older than the recent-scores list.

Unplayed past puzzles use `practice` mode with a puzzle date and number, with separate Archive scores. They do not add to Daily streaks or Daily distributions. If a player already started that date's original Daily, the archive reopens that game instead of allowing a new attempt. Existing random `practice` games without a puzzle number remain in Unlimited scores.

After finishing a Daily, see how many players connected in each of 1–8 turns or didn't connect, with your result highlighted. “You did better than X% of players” compares your outcome with other completed games for the same puzzle date: fewer turns beats more turns, any win beats a loss, and ties aren't beaten. Your own game is included in the chart but excluded from your comparison. The percentage rounds down; the first finisher sees a waiting message instead. Refresh to include later completions.

## Play

[Play Zonkey](https://zonkey.io).

Vercel creates a preview for each pull request; the deployment link appears on the PR and may require Vercel sign-in.

## Discoverability

The landing page includes server-rendered how-to and FAQ content, with matching FAQ and VideoGame JSON-LD. Keyword-focused titles, descriptions, canonical URLs, and the zebra Open Graph image use `https://zonkey.io`.

`/daily` provides the Archive calendar, with past dates available from September 30, 2026. Month navigation shows older puzzles and the current day's puzzle stays in Daily mode. Each `/daily/YYYY-MM-DD` page shows its puzzle number and starting pair without any player guesses or AI answers. The play button opens `/?daily=YYYY-MM-DD` to start or resume that puzzle, or view an existing result. Today's date uses the live Daily; unplayed earlier dates use archive practice. The server rejects invalid, pre-launch, and future play dates; the corresponding archive pages return 404.

`/sitemap.xml` lists the home page, archive, and published dates. The archive and sitemap render on request so each new UTC date appears without a rebuild. `/robots.txt` allows public pages and excludes API routes.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase · OpenAI · Vercel

## Local development

Use Node 24 (pinned in `.nvmrc`) and npm.

```bash
nvm install
nvm use
npm install
npm run dev        # http://localhost:3000
```

With no env vars set, the app runs with an in-memory store, deterministic mock AI, and a limited mock answer judge (dev only; production requires real services). The mock judge recognizes a small set of spelling/plural/synonym examples. General LLM correction and semantic comparison require `OPENAI_API_KEY`. In-memory games and counts reset when the server restarts; Supabase persists them.

### With local Supabase

```bash
npx supabase start          # applies supabase/migrations
# put the printed API URL + service_role key in .env.local:
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_SERVICE_ROLE_KEY=...
npm run dev
```

## Environment

See `.env.example`. All variables are server-only.

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | AI player (required in production) |
| `OPENAI_MODEL` | Default `gpt-4.1-mini` |
| `OPENAI_TEMPERATURE` | Default `0.2`; `none` to omit |
| `AI_REQUESTS_PER_PLAYER_HOUR` | AI generation/judging request limit per player; default `120` |
| `AI_REQUESTS_GLOBAL_HOUR` | AI generation/judging request limit across all players; default `5000` |
| `ZONKEY_SYSTEM_PROMPT` | Override the AI system prompt (`src/server/ai/prompt.ts`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Persistence (required in production) |

## Deploy (Vercel + Supabase)

1. Create a Supabase project and run `supabase/migrations/*.sql` (or `npx supabase db push`).
2. Import the repo in Vercel and set the env vars above.
3. Add `zonkey.io` to the Vercel project's domains and apply the DNS records Vercel provides.

For existing deployments, apply `20261004220234_daily_results.sql` before deploying the Daily results feature. It adds an index and the server-only `daily_results` aggregate RPC; existing completed games count immediately, without a backfill. The API and RPC both require the requesting player's own Daily to be complete, and the client only fetches results on the finished Daily screen. Unlimited, active games, and other puzzle dates aren't included.

Apply `20261005004644_daily_streaks_archive.sql` before deploying Daily streaks and playable archives. It updates the server-only `player_scores` RPC with streaks, separate Archive stats, and complete dated game history for the calendar, and adds a unique archive attempt per player/date. History includes completed and active games, exposes no answers, and prefers the original Daily if both modes exist for a date. Existing random practice games are unaffected. This migration is compatible with the previous app version.

The domain is the production identity; adding it to metadata does not deploy or configure DNS. Native sharing uses the current site's origin so development preview links remain playable.

## Design

The supplied zebra mascot anchors Zonkey's dark charcoal surfaces, zebra stripe texture, bold typography, and lime accents. Dark mode is rendered from the first page load, including native controls and the mobile browser theme. Daily stays the primary action; Unlimited, Archive, and saved scores are one tap away. The same palette carries through gameplay, reveals, result charts, scores, instructions, and social preview artwork. Game screens retain large words, generous touch targets, keyboard submission, and reduced-motion support.

Inspiration: [21st.dev Minimal Button](https://21st.dev/@radiumcoders/components/minimal-button). The styling uses the existing Tailwind/shadcn stack without new dependencies.

Returning players' anonymous IDs are copied to `zonkey:player-id` from the legacy browser storage key, keeping Daily progress and scores. The original key remains available for older open tabs. Anonymous IDs are scoped to the browser's origin; moving to a different domain creates a new browser identity. Existing `CONNECT_TWO_SYSTEM_PROMPT` overrides remain a fallback when `ZONKEY_SYSTEM_PROMPT` is unset. The local Supabase project ID remains unchanged to preserve existing development database volumes.

## Architecture

- `src/lib/game/` — pure rules: normalization, engine, daily pair selection, share text, client view projection.
- `src/server/ai/` — `AiPlayer` commits an independent answer before submission. A separate `AnswerJudge` corrects the player's submitted word and compares later guesses with the already committed AI answer using structured JSON. The AI player never sees the current player guess.
- `src/server/store/` — `GameStore` interface; Supabase (`submit_judged_answer` RPC with row locks, atomic global counts, and score aggregation) and in-memory implementations.
- `src/server/game-service.ts` — start / prepare (AI answers before the player can submit) / submit.
- `src/app/api/` — route handlers. Anonymous identity via `x-player-id` header (UUID persisted in `localStorage`).
- `src/components/game/` — mode picker, round, reveal, result and score screens.

The client never receives the current round's AI answer, and the server owns round number, game state, canonical words and win condition. If AI generation or judging fails, the round stays unanswered, no attempt is counted, and the player can retry.

Daily puzzle: `puzzle # = days since 2026-09-30 + 1`, so October 1, 2026 is #2 and October 2 is #3. The pair rotation stays anchored to October 1 using `src/lib/game/pairs.ts`. The original 32 pairs remain at the start of the expanded rotation, and puzzle #1 keeps its original pair, so existing shared boards do not move. Daily advances deterministically through the full pool while Unlimited samples the same pool randomly. Apply `20261001173953_daily_puzzle_numbers.sql` to update saved Daily game numbers and score history. The server's UTC date controls the live Daily for everyone. A requested published past date opens archive practice if unplayed, otherwise the original saved game. One attempt per anonymous browser identity per date; a completed puzzle opens its saved result. Clearing browser identity or using a different browser creates a new anonymous player.

First-round guesses are corrected to single canonical words by an LLM. Equivalent existing board words reuse the existing entry. Every new accepted first guess starts at 1; matching canonical guesses from other players increment that count. Daily boards are grouped by puzzle date, Unlimited boards by starting pair. Counts are updated in the submission transaction so concurrent retries cannot count twice. Existing first-round submissions are backfilled by the migration. Boards are only sent after the player has submitted their first guess.

First-round wins accept an exact match with either the normalized original guess or its corrected board word. Later rounds accept spelling variants, inflections and synonyms expressing the same concept in context; related but distinct concepts stay mismatches. Both revealed words remain visible even when a semantic match wins.

Supabase atomically enforces hourly AI request quotas before generation or judging, including concurrent calls from different server instances. Exceeding either limit returns HTTP 429; unanswered rounds remain retryable. Quotas reset on UTC hour boundaries and include failed model attempts.

First-guess writes check the board's attempt count while holding a transaction-scoped board lock. If another player commits during judging, the server rejudges against the updated vocabulary, up to three times, before asking the player to retry. Stale judgments never change the round or count.

Sharing calls `navigator.share({ title, text })` directly from the tap, before analytics. The result and link are one text item for messaging apps; clipboard and manual copy use the same message. Daily and Archive links preserve the puzzle date, including when sharing an original Daily result from the calendar. Gray/white square pairs mark different guesses and green pairs mark a connection, including semantic wins. Starting words and all guesses are hidden:

```text
Zonkey #2
Connected in 2/8 🦓

⬜⬜ 🟩🟩
https://zonkey.io/?daily=2026-10-01
```

On HTTPS Safari this requests the iPhone's native share sheet. If a containing iframe blocks Web Share, the result screen offers **Open game to share** in a separate tab. Unsupported browsers fall back to clipboard; **Copy result** is also available, with selectable text if clipboard access is denied. Cancelling the sheet is not treated as an error. Physical iOS sharing still needs verification on an iPhone.

## Scripts

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

To run the Supabase contracts as well as unit tests, set `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` to a migrated local Supabase instance before `npm test`. Contract tests create isolated test games in that database.
