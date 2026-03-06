# Job Scout

AI-powered job search agent that finds roles posted in the last 7 days across your selected locations (in-office, hybrid, or remote). Searches LinkedIn, Indeed, Glassdoor, ZipRecruiter, and more via JSearch, scores matches against your skills using Claude AI, and delivers results to your inbox.

---

## Features

- Editable job titles, skills, and locations (tag-based UI)
- Parallel job fetching across all titles and locations
- Claude Haiku scores each listing 1–10 and reports skills matched / missing
- Results delivered by email — no results shown in the UI
- Rate limiting: 3 searches per email and 10 searches per IP per 24 hours
- Input validation and caps on array sizes

---

## Tech stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic SDK |
| Job data | JSearch API (RapidAPI) |
| Email | Resend |
| Rate limiting | Upstash Redis |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Anthropic API key](https://platform.anthropic.com/)
- [JSearch API key](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) via RapidAPI — free tier (500 calls/month)
- [Resend account](https://resend.com) — free tier (3,000 emails/month)
- [Upstash Redis](https://upstash.com) — free tier for rate limiting

---

## Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy the env template and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```

3. Run locally:
   ```bash
   npm run dev -- -p 3001
   ```
   Open [http://localhost:3001](http://localhost:3001).

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | From [platform.anthropic.com](https://platform.anthropic.com) |
| `JSEARCH_API_KEY` | RapidAPI key for JSearch |
| `RESEND_API_KEY` | From [resend.com](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `CRON_TO_EMAIL` | Email address for the daily scheduled digest |
| `UPSTASH_REDIS_REST_URL` | From your Upstash Redis dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | From your Upstash Redis dashboard |

---

## Usage

### Web UI

Visit the app, enter your email, and click **Run Search & Send Email**. Results are scored by Claude and delivered to your inbox.

### CLI — run once

```bash
npm run agent
```

Sends the digest to `CRON_TO_EMAIL`. Customize titles, skills, and locations at the top of `agent.js`.

### CLI — daily schedule (8 AM)

```bash
npm run schedule
```

---

## Cost

Using Claude Haiku 4.5 (`$1/M input tokens`, `$5/M output tokens`):

| Run | Estimated tokens | Cost |
|-----|-----------------|------|
| Single run (20 jobs) | ~3,000 in + ~800 out | ~$0.007 |
| Daily run | ~8,000 in + ~1,500 out | ~$0.02 |
| Monthly (30 days) | — | ~$0.60 |

---

## Project structure

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Web UI — editable tags, email input, run button |
| `app/api/search/route.ts` | API route — fetches jobs, runs Claude, sends email |
| `agent.js` | CLI agent — fetches jobs, calls Claude, emails digest |
| `scheduler.js` | Runs CLI agent daily at 8 AM via node-cron |
| `.env.example` | Template for all required environment variables |