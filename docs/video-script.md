# Overturn — demo video script (target 2:30, hard cap 3:00)

Format: screen recording of the deployed site in a phone-sized browser window (375 × 812,
or a real phone mirrored), voice-over in English, calm pace. No background music louder
than the voice. Cursor movements slow. One idea per shot.

Record the sample **"ER visit billed out of network"** (Texas EOB). It shows the deadline
clock, the No Surprises Act moment, and a letter with real citations, in one path.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Title card: "Overturn" · "Understand and contest a health insurance denial". Then one line fades in: *19% of claims denied · < 1% appealed · 34% of appeals won* (KFF 2024). | "Every year, US insurers deny about one in five claims. Fewer than one percent get appealed, even though a third of appeals succeed. People don't skip the appeal because they agree. They skip it because the letter is unreadable and the deadline is invisible. This is Overturn." |
| 0:15–0:35 | Home page on the phone: the headline, then scroll to the two sheets ("From the letter" / "In plain English") and hold 2 s. Scroll back up. Tap **"Try a sample first"**. On the Start screen the samples tab is already open: tap **"ER visit billed out of network"**. | "It works with the document you already have: a denial letter or an Explanation of Benefits. Here is the whole idea in one glance: the insurer's sentence, and what it actually means. Before you upload anything, it tells you what it covers and what it doesn't. Let's use a sample." |
| 0:35–1:05 | Understand screen. Hold on **"The short version"** (what, how much, until when). Scroll to the plain-English summary and tap a dotted term (*provider* or *appeal*) to open its definition. Scroll to the deadline clock: date, days left, open **"How this date was calculated"**. On the first fact card tap **"Where is this from?"** → the quote appears. | "First, the short version: what was denied, what you may owe, and until when you can answer. Then the whole document in plain English; every word of jargon has a definition. Here is the first deadline, as a date, with the rule and the source it comes from. And every fact shows the exact sentence it was read from. Nothing is summarized without a receipt." |
| 1:05–1:45 | Tap **"Continue: my rights and deadlines"**. Rights screen: show the five questions, already filled from the document (banner). Scroll: the deadlines, then **"What applies to your situation"** with the No Surprises Act card first: "Why this applies to you", the CFR reference, the **Source** link, "Verified" date. Hover the label **"From the rules dataset, not AI"**. | "Five questions, and Overturn computes which protections apply. This was an emergency visit, so the No Surprises Act comes first: in-network cost sharing, no balance billing. Look at the label: this part is not written by the AI. Which rules apply is decided by code, from a dataset where every rule carries its legal citation, its primary source, and the date a human last verified it." |
| 1:45–2:15 | Tap **"Draft my appeal letter"**. Letter screen: type a name in **"Fill in your details once"**, tap **"Put these in the letter"** and show the blanks disappearing in the letter. Scroll the letter slowly; pause on an `[ADD: …]` blank and on a **[1]** footnote, then on **"References used in this letter"**. Tap **"Download PDF"** → the download appears. Show **"What to attach"** and **"Before you send"**. | "Then the letter. Written in your voice, from your facts and those rules only. Anything Overturn doesn't know is a visible blank, never a guess. Every legal reference in the letter is one the code produced; the AI cannot add its own. You edit it, download it, and send it yourself. And at every step there's a button to reach a real person for free." |
| 2:15–2:35 | Back to the home page, scrolled to **"The model reads. The code decides. You send."** with its four proofs. Then the README "What is deliberately not built" table for two seconds. | "That's the whole design: the model reads, the code decides, the human sends. It covers federal rules everywhere and state rules for California, New York, and Texas, and it says so when it reaches the edge of what it knows. Built solo in nine days, tested against production, documented for anyone to extend." |
| 2:35–2:45 | End card: GitHub URL, live URL, "Information, not legal advice." | "Overturn. Understand the letter. Know the deadline. Answer back." |

## Recording checklist

- Deployed URL (https://overturn-peach.vercel.app), not localhost. New private window so sessionStorage is empty.
- Browser zoom 100%, phone-width window (375 × 812) or DevTools device mode without the frame.
- Hide bookmarks bar, extensions, notifications. Light mode (tap the moon icon if the system is dark).
- The home page fades sections in as you scroll: scroll a little slower than usual so nothing appears mid-shot.
- Cursor: slow, deliberate, no jitter. Pause 1 s on each thing named in the voice-over.
- Record voice separately if the room is noisy; align in the editor.
- Export 1080p, MP4 (H.264), ≤ 3:00. Upload unlisted on YouTube; test the link logged out.

## Screenshots to take (same session)

Already generated by `BASE=https://overturn-peach.vercel.app node scripts/screenshots.mjs` into `docs/screenshots/`:

1. Landing, phone width, above the fold
2. Start screen with the samples
3. Understand: the short version + summary
4. Understand: a fact card with the quote revealed
5. Rights: the questions
6. Rights: the No Surprises Act card with source link
7. Rights: the deadline clock with the calculation open
8. Letter: the letter with blanks and footnotes
9. Letter: "What to attach" and "Before you send"
10. Unsupported stop screen (Medicare sample)
11. Desktop width: Rights screen (shows it is not phone-only)
12. Learn page
