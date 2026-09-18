# Overturn

**Understand and contest a health insurance denial — in plain English, with the deadlines and
protections that apply, and a letter you can send.**

LexHack 2026 entry · Tracks: *Access to Justice & Civic Tech*, *Legal Automation & Workflow Innovation*

> Live: https://overturn.vercel.app · Status: under construction (submission Sept 27, 2026)

## The problem

Fewer than 1 in 200 denied health insurance claims are ever appealed, yet a large share of
appeals succeed. People do not appeal because the letter is unreadable, the rights are unknown,
and the deadline is invisible. *(Sources to be cited here.)*

## What Overturn does

1. **Reads** your denial letter or Explanation of Benefits (PDF or photo).
2. **Explains** what happened at an 8th-grade reading level, with every fact traceable to the
   exact sentence in your document.
3. **Computes** which protections and deadlines apply — federal baseline plus state overlays
   for California, New York, and Texas — with a primary source for every rule.
4. **Drafts** an appeal letter built only from your facts and those rights, which you edit,
   download, and send yourself.

## What Overturn deliberately does not do

| Not built | Why |
|---|---|
| Medicare, Medicaid, TRICARE, VA | Different multi-level appeal systems; an approximately-right deadline harms people. |
| The other 47 states | Each state's external-review law differs. Three states, three regulator models, honest federal fallback elsewhere. |
| Itemized bill audit (CPT codes, upcoding) | Needs billing and price databases; a different product. |
| Sending the letter, accounts, case history | Would require storing protected health information. |
| Spanish | High impact, deferred; the architecture makes it a cheap v2. |

## Architecture: the model reads, the code decides, the human sends

_(to be completed)_

## Legal design: information, not advice

_(to be completed — see LEGAL_DESIGN.md)_

## Privacy

Documents are processed in memory during a single request and discarded. No database, no
uploads stored, no analytics on document content. The demo uses synthetic sample documents.

## Stack & credits

_(to be completed — every library, model, dataset, and AI tool, with license)_

## Run locally

```bash
pnpm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
pnpm dev
```
