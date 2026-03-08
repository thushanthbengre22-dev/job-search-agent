# Job Scout

AI-powered job search agent that finds roles posted in the last 7 days across your selected locations (in-office, hybrid, or remote). Searches LinkedIn, Indeed, Glassdoor, ZipRecruiter, and 20+ other job boards via JSearch, scores matches against your profile using Claude AI, and delivers results to your inbox.

---

## Features

- **Resume upload** — upload up to 3 PDFs; Claude extracts your skills, job titles, and years of experience and autofills the form
- **Per-job resume matching** — each result in the email identifies the best-fit resume and gives tailored tips per job description
- **Editable tags** — customize job titles (5 max), skills, and location (1 max) before searching
- **Years of experience slider** — set manually or autofilled from your resume (career breaks excluded)
- **Batched job fetching** — parallel requests across all titles, 2 at a time with rate-limit-safe delays and retry logic
- **AI scoring** — Claude Haiku scores each listing 1–10, reports skills matched and missing
- **Email delivery** — results sent to your inbox with formatted HTML; nothing shown in the UI
- **Daily cron digest** — automated search uses your Vercel Blob resumes to produce the same resume-matched email as the UI
- **Abuse protection** — IP rate limiting on all endpoints, email allowlist, per-email daily caps, and monthly API usage cap
- **Android-aware upload** — shows a Google Drive tip on Android devices

---

## How it works

### Manual search flow

```mermaid
flowchart TD
    A([User]) -->|Upload PDF resumes| B["POST /api/parse-resume"]
    B -->|PDF as base64| C["Claude Haiku\nAnthropic API"]
    C -->|skills, titles, yearsOfExp| B
    B -->|Autofill form| A

    A -->|"titles, skills, location, email"| D{"Upstash Redis\nRate Limiter"}
    D -->|"IP: 20/day, Allowlist check, Email: 2/day"| E["POST /api/search"]
    D -->|Blocked| F([429 / 403])

    E -->|Batched 2 at a time| G["JSearch API\nRapidAPI"]
    G -->|Up to 20 job listings| E

    E -->|Job list + candidate profile| H["Claude Haiku\nAnthropic API"]
    H -->|"Scored, filtered, resume tips"| E

    E -->|Formatted HTML digest| I[Resend]
    I -->|Email| J([User Inbox])
```

### Daily cron flow

```mermaid
flowchart TD
    A(["Vercel Cron\n1x per day"]) -->|Bearer CRON_SECRET| B["GET /api/cron"]
    B -->|Fetch PDFs| C["Vercel Blob Storage"]
    C -->|PDF as base64| D["Claude Haiku\nAnthropic API"]
    D -->|skills, titles, yearsOfExp| B
    B -->|"Check monthly cap\nUpstash Redis"| E{Within limit?}
    E -->|No| F([Skip / 429])
    E -->|"Yes, parsed titles as queries"| G["JSearch API\nRapidAPI"]
    G -->|Up to 20 job listings| B
    B -->|Job list + resume profiles| H["Claude Haiku\nAnthropic API"]
    H -->|"Scored digest + resume tips"| B
    B -->|Formatted HTML| I[Resend]
    I -->|Email| J([CRON_TO_EMAIL Inbox])
```

---

## Tech stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) via Anthropic SDK |
| Job data | JSearch API (RapidAPI) — 20+ job boards |
| Email | Resend |
| Rate limiting / storage | Upstash Redis |
| Resume storage (cron) | Vercel Blob |
| Cron | Vercel Cron Jobs |
| Testing | Vitest |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Anthropic API key](https://platform.anthropic.com/)
- [JSearch API key](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) via RapidAPI — Pro plan recommended ($25/month, 10,000 calls/month)
- [Resend account](https://resend.com) — free tier (3,000 emails/month)
- [Upstash Redis](https://upstash.com) — free tier works fine
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) — for cron resume storage (free tier works fine)

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
| `RESEND_FROM_EMAIL` | Verified sender address (e.g. `Job Scout <scout@yourdomain.com>`) |
| `CRON_TO_EMAIL` | Email address for the daily scheduled digest |
| `CRON_SECRET` | Secret token used to authenticate Vercel Cron requests |
| `EXEMPT_EMAIL` | Your personal email — bypasses the allowlist and gets a 50/day rate limit |
| `JSEARCH_MONTHLY_LIMIT` | Max JSearch API calls per month (default: `9800`) |
| `UPSTASH_REDIS_REST_URL` | From your Upstash Redis dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | From your Upstash Redis dashboard |
| `RESUME_BLOB_URL_1` | Vercel Blob public URL for your first resume PDF |
| `RESUME_BLOB_URL_2` | Vercel Blob public URL for your second resume PDF (optional) |
| `RESUME_BLOB_URL_3` | Vercel Blob public URL for your third resume PDF (optional) |

---

## Cron resume setup

The daily cron parses your resumes from Vercel Blob on each run — no hardcoded skills needed.

1. Go to your Vercel project → **Storage** tab → **Blob**
2. Upload up to 3 resume PDFs
3. Copy each public URL and add as `RESUME_BLOB_URL_1`, `RESUME_BLOB_URL_2`, `RESUME_BLOB_URL_3` in your Vercel environment variables

If no blob URLs are set, the cron falls back to a hardcoded profile defined in `app/api/cron/route.ts`.

---

## Abuse protection

All API routes are protected against scripted abuse:

| Layer | Limit |
|-------|-------|
| IP rate limit (search) | 20 requests / IP / day |
| IP rate limit (parse-resume) | 10 requests / IP / day |
| Email allowlist | Only emails added to Redis can trigger a search |
| Email rate limit | 2 searches / email / day |
| Exempt email rate limit | 50 searches / day for `EXEMPT_EMAIL` |
| Monthly API cap | Configurable via `JSEARCH_MONTHLY_LIMIT` (default 9,800) |
| Input sanitization | Max 5 titles, 1 location, 30 skills — each string capped at 100 chars |

### Adding an email to the allowlist

Use the Upstash Redis CLI or REST API:
```
SADD job-scout:allowed-emails user@example.com
```

---

## Cron schedule

Configured in `vercel.json`. To change the time, edit the `schedule` field (UTC):

```json
{
  "crons": [
    {
      "path": "/ai-lab/job-search-agent/api/cron",
      "schedule": "0 13 * * *"
    }
  ]
}
```

---

## Testing

```bash
npm test           # single run
npm run test:watch # watch mode
```

63 tests across 7 files with ~100% coverage of all shared lib functions:

| File | Coverage |
|------|---------|
| `lib/email.ts` | 100% |
| `lib/jsearch.ts` | 100% |
| `lib/usage.ts` | 100% |
| `lib/resume.ts` | ~97% |

---

## Project structure

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Web UI — resume upload, tag inputs, experience slider, email, run button |
| `app/api/search/route.ts` | Streaming API route — fetches jobs, runs Claude, sends email |
| `app/api/parse-resume/route.ts` | Parses uploaded PDF resumes with Claude, returns skills/titles/experience |
| `app/api/cron/route.ts` | Vercel Cron handler — fetches resumes from Blob, runs full digest |
| `lib/jsearch.ts` | `Job` interface and `fetchJobs()` with retry logic |
| `lib/usage.ts` | Redis client, monthly usage counter, `checkAndIncrementUsage()` |
| `lib/email.ts` | `formatEmailHtml()` — shared HTML email formatter with markdown rendering |
| `lib/resume.ts` | `parseResumeBase64()`, `mergeProfiles()`, `buildResumePromptSections()` |
| `__tests__/` | Vitest unit tests for all lib functions |
| `vercel.json` | Vercel Cron schedule |
| `.env.example` | Template for all required environment variables |

---

## Cost estimate

Using Claude Haiku (`$1/M input`, `$5/M output`):

| Run | Estimated tokens | Cost |
|-----|-----------------|------|
| Manual search (20 jobs, 1,500-char JDs) | ~5,000 in + ~1,500 out | ~$0.013 |
| Resume parse (1 PDF) | ~2,000 in + ~300 out | ~$0.003 |
| Daily cron digest (resume parse + scoring) | ~7,000 in + ~1,500 out | ~$0.014 |
| Monthly (30 days cron only) | — | ~$0.42 |