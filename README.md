# Zonkey

zonkey.io

**Meet in the middle.** A mobile-first daily word-convergence game against an AI.

You and the AI each pick a word connecting two endpoints. Different words become the next guess's endpoints; matching words connect. From guess 2 onward, equivalent meanings also connect.

**Daily** has five independent rounds each UTC day, with up to five guesses per round. Connecting on guesses 1–5 earns **1,000 / 800 / 600 / 400 / 200** points; an exhausted round earns **0**. Always continue through all five rounds for a total out of **5,000**. Everyone gets the same five deterministic starting pairs. AI commitments are shared for identical date/round/guess/endpoint states. **Unlimited** keeps eight-turn games with fresh random starting pairs. The catalog has 1,365 words and 6,924 distinct pairs.

Daily streaks count consecutive UTC days where the player finishes that day's puzzle before midnight. Wins and losses both count. A streak ending yesterday remains current until today's deadline; missing a day resets the current streak while preserving the best. Existing on-time completions count automatically. Home, Daily results, and Daily scores show both current and best streaks.

**Archive** is the third mode beside Daily and Unlimited. It opens a month calendar with a list of that month's past puzzles underneath. Unplayed dates can be played; completed dates show the saved score and reopen the result; unfinished dates resume their saved game. Original Daily results appear alongside archive attempts, including games older than the recent-scores list.

Every published date, starting September 30, 2026, is playable in the five-round format. The original first pair and puzzle number are preserved; four additional pairs are deterministic. One five-round run is saved per anonymous player/date and can be resumed. Archive runs do not count in live Daily distributions or streaks. Old one-puzzle games remain accessible as **Previous format results**, separately from the new scores; their unplayed rounds are not assigned invented points.

After finishing all five Daily rounds, a curve plots actual player counts at every attainable score (0–5,000 in 200-point steps), with your score highlighted and counts included in the chart's screen-reader description. It does not fit a synthetic normal distribution. “You did better than X% of players” compares strictly lower scores among other completed live Daily runs for that date. Ties are not beaten; your own run is included in the chart but excluded from the percentile. The percentage rounds down; the first finisher sees a waiting message. Archive, active, and previous format results are excluded.

### Database rollout and backfill

Apply migrations in order, including `20261005040000_five_round_daily.sql`, **before** deploying this app version. The additive migration uses separate tables and RPCs; existing game records and production prompts are unchanged. Only the server's service role can access Daily state, AI commitments, and aggregates. Database row locks and expected round/guess numbers make retries and concurrent submissions safe.

With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set, run `npm run backfill:daily` for a dry run, then `npm run backfill:daily -- --apply` to seed all published dates. It only inserts missing puzzle definitions and is safe to repeat; it never overwrites a puzzle or changes player results. Future dates are created when first played using the same schedule.

Run `npm run test:db` against local Supabase to test both stores, including the five-round atomic state transitions and database permissions. It uses credentials from the local Docker containers and never prints or persists their signing keys.

## Play

[Play Zonkey](https://zonkey.io).

Vercel creates a preview for each pull request; the deployment link appears on the PR and may require Vercel sign-in.

## Discoverability

The landing page includes server-rendered how-to and FAQ content, with matching FAQ and VideoGame JSON-LD. Keyword-focused titles, descriptions, canonical URLs, and the zebra Open Graph image use `https://zonkey.io`.

`/daily` provides the Archive calendar, with past dates available from September 30, 2026. Month navigation shows older puzzles and the current day's puzzle stays in Daily mode. Each `/daily/YYYY-MM-DD` page shows its puzzle number and starting pair without any player guesses or AI answers. The play button opens `/?daily=YYYY-MM-DD` to start or resume that puzzle, or view an existing result. Today's date uses the live Daily; unplayed earlier dates use archive practice. The server rejects invalid, pre-launch, and future play dates; the corresponding archive pages return 404.

`/sitemap.xml` lists the home page, archive, and published dates. The archive and sitemap render on request so each new UTC date appears without a rebuild. `/robots.txt` allows public pages and excludes API routes.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase · OpenAI · Vercel

## Zonkey Plus

Plus unlocks Unlimited and historical Archive gameplay for **$5 USD once**, with no renewal. Today's Daily remains free and anonymous. Completed results and the public Archive pages remain readable. Starting, resuming, preparing, and submitting paid games are checked on the server, including old practice routes and yesterday's unfinished Daily.

Email sign-in uses Supabase OTP and server-managed, HTTP-only session cookies. The first browser's anonymous player ID becomes the account's permanent player ID, preserving its saved games and streaks. Subsequent devices use that account ID. A browser ID already attached to another account is never reassigned; the new account receives a fresh ID. Separate histories created on other devices before sign-in are not merged. Sign-out gives the browser a new anonymous ID; sign back in to restore account history and Plus.

### Rollout

The paywall defaults off. Deploy the migration and configure the services before setting `ZONKEY_PLUS_ENABLED=true`; leaving it off preserves existing free access.

1. Apply `supabase/migrations/20261007000000_plus_accounts.sql` after the existing migrations. Account mappings and purchase records are service-role-only tables.
2. In Supabase Authentication, configure **custom SMTP** with a verified sender. The default mail service is restricted to project team addresses and is not suitable for public sign-in. In the **Magic Link email template**, include `{{ .Token }}` so players receive a code, for example:

   ```html
   <h2>Sign in to Zonkey</h2>
   <p>Your sign-in code is <strong>{{ .Token }}</strong>.</p>
   ```

3. Set these Vercel environment variables:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | Existing project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Existing server key |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key or legacy `anon` key, **not** the service role key |
   | `ZONKEY_SITE_URL` | `https://zonkey.io` in Production; the preview's own origin for test checkout |
   | `STRIPE_SECRET_KEY` | Stripe sandbox/test secret in Preview, live secret in Production |
   | `STRIPE_WEBHOOK_SECRET` | Signing secret for the matching environment's webhook endpoint |
   | `ZONKEY_PLUS_ENABLED` | `true` once the service setup is complete |

4. In Stripe Workbench/Webhooks, add `https://zonkey.io/api/stripe/webhook`, listening to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Put that endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`. Configure a separate sandbox endpoint and secret for any preview used to test payments.
5. Checkout creates its one-time $5 price on the server. No recurring product or separate price ID is needed. Card checkout supports eligible wallets through Stripe.
6. Redeploy after environment changes. Test verified email sign-in, a sandbox payment, duplicate webhook delivery, and restoration from a second browser before enabling the live paywall. Never use live Stripe keys in a preview.

Checkout is associated with the verified Supabase user, not an email supplied by the payment form. The signed webhook retrieves the actual Stripe session and validates product metadata, account ID, payment status, mode, currency, and amount. Session and payment-intent uniqueness prevent repeat grants. The return screen performs the same verification to unlock promptly when webhook delivery is delayed. A failed database write returns an error so Stripe retries. Unpaid or cancelled sessions never grant access. Restore access by signing in with the original purchase email; no second payment is needed.

Refunds and disputes do not automatically revoke access in this version; manage refunds in Stripe and revoke a purchase in the server-only table if needed. Existing AI request limits remain in place.

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

The supplied zebra mascot anchors Zonkey's desert safari theme: sand backgrounds, cream surfaces, terracotta actions, olive connections, and brown text. Serif headings and a compact sun, dunes, and acacia illustration complement the simple home screen. The light palette is rendered from the first page load, including native controls and the mobile browser theme. Daily stays the primary action; Unlimited, Archive, and saved scores are one tap away. Shared theme tokens carry through gameplay, reveals, result charts, scores, and instructions. Game screens retain large words, generous touch targets, keyboard submission, and reduced-motion support.

Inspiration: [21st.dev Minimal Button](https://21st.dev/@radiumcoders/components/minimal-button). The styling uses the existing Tailwind/shadcn stack without new dependencies.

Returning players' anonymous IDs are copied to `zonkey:player-id` from the legacy browser storage key, keeping Daily progress and scores. The original key remains available for older open tabs. Anonymous IDs are scoped to the browser's origin; moving to a different domain creates a new browser identity. Existing `CONNECT_TWO_SYSTEM_PROMPT` overrides remain a fallback when `ZONKEY_SYSTEM_PROMPT` is unset. The local Supabase project ID remains unchanged to preserve existing development database volumes.

## Architecture

- `src/lib/game/` — pure rules: normalization, engine, daily pair selection, share text, client view projection.
- `src/server/ai/` — `AiPlayer` chooses an independent answer using only the endpoint words. A separate `AnswerJudge` corrects the player's submitted word and compares later guesses with the already committed AI answer using structured JSON. The AI player never sees the current player guess.
- `src/server/store/` — `GameStore` interface; Supabase (`submit_judged_answer` RPC with row locks, atomic global counts, and score aggregation) and in-memory implementations.
- `src/server/game-service.ts` — start / prepare / submit. The start API returns immediately without waiting for an LLM. Players can type and submit during preparation; submission waits for an independently generated commitment before judging the guess. Overlapping preparation and submission requests share pending generation within a server instance, and stored commitments resolve races across instances.
- `src/app/api/` — route handlers. Anonymous identity via `x-player-id` header (UUID persisted in `localStorage`).
- `src/components/game/` — mode picker, round, reveal, result and score screens.

The client never receives the current round's AI answer, and the server owns round number, game state, canonical words and win condition. If AI generation or judging fails, the round stays unanswered, no attempt is counted, and the player can retry.

Daily preparation also warms the opening answers for the remaining fixed pairs in parallel. These are cached in the existing private `daily_ai_answers` table and reused across players. A failed warm-up is retried when that round is reached; no fallback answer is generated. Later guesses are prepared as their endpoint words become known.

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
