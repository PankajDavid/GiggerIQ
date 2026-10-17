# GiggerIQ

A mobile-first GenAI companion for Indian gig and informal workers (delivery partners, drivers, daily-wage workers). Built for the PromptWars Chandigarh warm-up challenge "Gig Worker Companion".

## What it does

| Feature | How it works |
|---|---|
| **My Earnings** | Manual entry of date, platform, amount and hours. Shows total earned, total hours and per-hour rate. Edit and delete supported. **AI summary** explains the week and gives tips. |
| **Complaint letter** | Worker describes a problem (e.g. unpaid payout, unfair deactivation). AI drafts a formal, editable letter with a copy button. Labelled as informational, not legal advice. |
| **Safety tips** | Worker describes their work situation. AI gives practical safety advice, including emergency number 112. |
| **Welfare schemes** | Grounded answers about real government schemes (e-Shram, PM-SYM, Ayushman Bharat PM-JAY, PMSBY, PMJJBY, APY, PM SVANidhi) with official links. |
| **Explain a document** | Worker uploads a photo of a letter or form. AI explains it in simple words. |

All AI replies come in **English or Hindi**, chosen with the language switcher.

## Generative AI used, and where

- **Google Gemini (`gemini-2.5-flash`) via the official `@google/genai` SDK**, called only from the server in `app/api/ask/route.ts` through the shared helper `lib/gemini.ts`.
- Used for all five AI features: earnings summary, complaint drafting, safety tips, scheme answers, and document explanation (Gemini vision reads the uploaded photo).
- Prompts live in `lib/prompts.ts`.

## How scheme answers avoid hallucination

1. The server picks the top 3 relevant records from `data/schemes.json` by keyword match (`lib/schemes.ts`).
2. Only those records are sent to Gemini, with instructions to answer only from them.
3. Gemini must end with a `SOURCES:` line listing the scheme IDs it used.
4. The server checks every cited ID was in the records it sent. If not, or if nothing matched, the worker gets an honest "I don't know" with a link to the official e-Shram portal.

## Why earnings are entered manually

Gig platforms (Swiggy, Zomato, Uber, Rapido and others) offer no public API for workers' earnings, and scraping their apps would break their terms. Earnings are stored **only on the worker's phone** (browser localStorage) and are sent to the server only when the worker asks for an AI summary. Nothing is stored on the server.

## Security

- Gemini API key is server-side only, read from environment variables; `.env` is git-ignored.
- Same-origin check on the API; all input validated with `zod` (text max 1000 chars, fixed modes and languages).
- Rate limiting: 10 requests per minute per IP, plus a hard daily cap on Gemini calls (`DAILY_AI_CAP`). When limits are hit, users see "GiggerIQ is busy" instead of the app making unlimited paid calls.
- Uploads: JPG, PNG or WebP only, max 4 MB, and the **actual file bytes** are checked, not just the declared type. Images are processed in memory and never stored or logged.
- AI output is treated as untrusted and always rendered as plain text, never HTML. User and document text is passed to the model as data, never as instructions.
- No user text, images or IP addresses are logged. Complaint text is never stored.
- Security headers: `nosniff`, `X-Frame-Options: DENY`, strict referrer policy.
- Stored earnings are re-validated when read, so tampered localStorage data is dropped.

**Free-tier note:** this deployment uses the Gemini API free tier, whose terms allow Google to use prompts to improve its products. The app warns users not to enter Aadhaar, bank or card numbers.

## Run locally

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev            # http://localhost:3000
npm test               # unit tests
```

## Deploy (Railway)

Connect the GitHub repo, set `GEMINI_API_KEY` in Variables, and generate a domain. Railway runs `npm run build` and `npm start` automatically.

## Tests

`tests/core.test.ts` covers earnings maths, tampered storage, request validation, real image signature checks, and scheme citation verification.

## Known limitations

- Rate limits are in memory, so they reset if the server restarts (acceptable for a single instance).
- Image dimensions are not checked separately; file size is capped at 4 MB.
- Earnings live on one device and are not synced.
