# Hotel Ops Sales Tracker

A lightweight tracker for selling hotel operations software in two stages:

1. **Stage 1 — Operations inquiry.** Call the front desk / night audit during a quiet period and learn how housekeeping, houseman, maintenance, shuttle, parking and wake-up workflows actually run. The call form is built from tap-to-answer chips so logging takes under two minutes, and an **Opportunity Score (0–100)** is calculated from operational pain, not hotel size.
2. **Stage 2 — Management outreach.** Promote qualified hotels, add GM / Director of Rooms / Chief Engineer contacts, track every call, email and LinkedIn touch, book demos, and track the deal — always with the Stage 1 findings summarised at the top.

## Stack

- Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS v4
- Supabase: Postgres, Auth (email/password), Row-Level Security
- Deployed on Vercel

## Pages

| Route | What it's for |
|---|---|
| `/` | Dashboard: funnel metrics, overdue actions, tonight's calls, follow-ups due, upcoming demos, top opportunities, auto insights |
| `/hotels` | Searchable / filterable list, CSV import & export |
| `/hotels/[id]` | Hotel profile: Stage 1 summary, "Move to Stage 2?" decision, manual-workflow flags, pain points, timeline, contacts, demos, deal, next action |
| `/hotels/[id]/call` | Stage 1 quick-call form with live score |
| `/hotels/[id]/demo` | Demo prep — recommends only workflows with Stage 1 evidence |
| `/calls` | Calls Tonight queue with filter chips |
| `/outreach` | Management Outreach queue with Call / Email / LinkedIn / Note / Book Demo |
| `/pipeline` | Board from research to closed |
| `/analytics` | Market discovery: how hotels run each workflow today |
| `/settings` | Default pricing, exports, import |

## Data model

`organizations` → `org_members` (multi-user ready) → `hotels` with `contacts`, `inquiry_calls` (Stage 1, answers as JSON), `pain_points`, `activities` (timeline incl. management calls), `deals` (one per hotel; TCV/MRR/ARR are generated columns), `demos`, `tasks`.

Every table carries `org_id` and is protected by RLS (`org_id in user_org_ids()`). Inserts get `org_id` automatically from `default_org_id()`.

**Sign-up is locked to one owner.** The first account created becomes the workspace owner; later sign-ups are rejected unless the email is in `public.invites` (the hook for adding teammates later).

Migrations live in `supabase/migrations/`.

## Scoring

Implemented in `src/lib/scoring.ts`: +10 per operational pain signal, +5 per property trait (100+ rooms, airport, 24h shuttle, long-term parking, full service, multiple departments), −20 when an ops platform already covers most workflows, −10 when the PMS handles almost everything, −20 when management says there's no pain, −15 when corporate controls tech. Capped 0–100. Classification: Low <30 · Monitor 30–49 · Good 50–69 · Strong 70–84 · Very Strong 85+. Both can be overridden per hotel.

## Local development

```bash
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm install
npm run dev
```
