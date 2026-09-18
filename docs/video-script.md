# Overturn — demo video script (target 2:30, hard cap 3:00)

Format: screen recording of the deployed site on a phone-sized browser window (375 px wide,
or a real phone mirrored), voice-over in English, calm pace. No background music louder than
the voice. Cursor movements slow. One idea per shot.

Record the sample **"ER visit billed out of network"** (Texas EOB). It shows the deadline clock,
the No Surprises Act moment, and a letter with real citations, in one path.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Title card: "Overturn" · "Understand and contest a health insurance denial". Then one line fades in: *19 % of claims denied · < 1 % appealed · 34 % of appeals won* (KFF 2024). | "Every year, US insurers deny about one in five claims. Fewer than one percent get appealed, even though a third of appeals succeed. People don't skip the appeal because they agree. They skip it because the letter is unreadable and the deadline is invisible. This is Overturn." |
| 0:15–0:35 | Home page on phone: hero and the before/after card, then tap "Start with my document"; on the Start screen, tap "ER visit billed out of network". | "It works with the document you already have: a denial letter or an Explanation of Benefits. Before you upload anything, it tells you what it is and what it is not. Let's use a sample." |
| 0:35–1:05 | Understand screen. Read the plain-English summary. Tap a glossary term (*balance billing*). Scroll to the deadline clock: date, days left, open "How this date was calculated". Tap "Where is this from?" on the denial reason → quote appears. | "In plain English: what was denied, why, and how much is at stake. Every word of jargon has a definition. Here is the first deadline, as a date, with the rule and the source it comes from. And every fact shows the exact sentence it was read from. Nothing is summarized without a receipt." |
| 1:05–1:45 | Rights screen. Show the five questions pre-filled; flip "self-funded" to *I don't know* on the NY sample if time, otherwise stay. Scroll: the No Surprises Act card is first, with "Why this applies to you", the caveat, the CFR reference, and the *Source* link. Hover the label *From the rules dataset, not AI*. | "Five questions, and Overturn computes which protections apply. This was an emergency visit, so the No Surprises Act comes first: in-network cost sharing, no balance billing. Look at the label: this part is not written by the AI. Which rules apply is decided by code, from a dataset where every rule carries its legal citation, its primary source, and the date a human last verified it." |
| 1:45–2:15 | Letter screen. Scroll the letter slowly; pause on a `[ADD: …]` blank and on a citation. Tap a section, type one word, tap Done. Tap "PDF" → download appears. Show "What to attach" and "Before you send". | "Then the letter. Written in your voice, from your facts and those rules only. Anything Overturn doesn't know is a visible blank, never a guess. Every legal reference in the letter is one the code produced; the AI cannot add its own. You edit it, download it, and send it yourself. And at every step there's a button to reach a real person for free." |
| 2:15–2:35 | Back to the landing "How it works" card: *The model reads. The code decides. You send.* Then the README "not built" table for two seconds. | "That's the whole design: the model reads, the code decides, the human sends. It covers federal rules everywhere and state rules for California, New York, and Texas, and it says so when it reaches the edge of what it knows. Built solo in nine days, tested against production, documented for anyone to extend." |
| 2:35–2:45 | End card: GitHub URL, live URL, "Information, not legal advice." | "Overturn. Understand the letter. Know the deadline. Send the appeal." |

## Recording checklist

- Deployed URL (https://overturn-peach.vercel.app), not localhost. Clear sessionStorage before recording (new private window).
- Browser zoom 100 %, phone-width window (375 × 812) or DevTools device mode without the frame.
- Hide bookmarks bar, extensions, notifications. Light mode.
- Cursor: slow, deliberate, no jitter. Pause 1 s on each thing named in the voice-over.
- Record voice separately if the room is noisy; align in the editor.
- Export 1080p, MP4 (H.264), ≤ 3:00. Upload unlisted on YouTube; test the link logged out.

## Screenshots to take (same session)

1. Landing, phone width, above the fold (the three cards visible)
2. Understand: summary + deadline clock
3. Understand: a fact card with the quote revealed
4. Rights: the questions
5. Rights: the No Surprises Act card with source link and caveat
6. Letter: blanks panel + first sections with citations
7. Letter: "What to attach" and "Before you send"
8. Unsupported stop screen (Medicare sample)
9. Desktop width: Rights screen (shows it is not phone-only)
