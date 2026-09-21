# Overturn on Alexa+ — demo video script (target 2:40, hard cap 3:00)

Hackathon rule: **best content in the first 30 seconds.** So the video opens *inside* the
conversation — no title card, no problem statement first. The narrator's context comes at 0:30,
after the viewer has already heard the assistant read a denial back.

Format: 1080p landscape. Main frame = the simulator (`/sim`) in a desktop browser, transcript
visible; a **phone in the frame** (webcam or phone mirror) for the companion upload; picture-in-
picture for the inbox and MCP Inspector. Three voices: the **assistant** (Polly, recorded live from
the simulator), the **user** (you, live at the mic — short phrases recognise well), the **narrator**
(voice-over, recorded separately; en-US neural TTS is fine, as for Argus). No music above −20 dB.

Recording run: sample **02 — prior authorization, California** (the T1–T12 script in
`specs/002-alexa-voice-mcp/voice-design.md`; reference transcript with tool calls in
`docs/transcripts/us1-sample02-ca-prior-auth.md`). Day counts assume recording on 2026-10-21; if you
record another day the assistant will say a different number — that is fine, the caption strip must match. Do a full dry run first; the assistant's turns are
templated, so timings are stable.

| Time | Shot | What is heard |
|---|---|---|
| **0:00–0:08** | Cold open. Kitchen-table framing if possible: phone lying next to a printed "sample" letter, laptop with `/sim` open. Mic button pulses. | **User:** "Alexa, my insurance denied my claim. Help me appeal." **Assistant (T1):** "I can help you understand the denial and prepare an appeal letter — it's information, not legal advice. First, do you have the denial letter in front of you?" |
| **0:08–0:18** | User: "Yes." Assistant speaks the code; cut to the **phone**: companion page, code typed, photo of the sample letter taken, "Reading…" then "Done — go back to your voice assistant". | **Assistant (T2):** "…enter this code: A-C-F, 3-4-7. Then take a photo…" *(phone sounds, 4 s)* |
| **0:18–0:30** | Back to `/sim`. The read-back appears in the transcript as it is spoken. Freeze 1 s on the read-back bubble. | **User:** "It's uploaded." **Assistant (T3):** "Here's what I read: Pacific Crest Health Plan denied a laparoscopic gallbladder removal from September 4th, billed at eighteen thousand seven hundred fifty dollars, because prior authorization wasn't obtained. Is that right?" **User:** "Yes." |
| **0:30–0:45** | Lower-third: *Overturn · Alexa+ track · self-hosted MCP server*. Transcript keeps scrolling silently through T4–T7 (sped up 2×, audio ducked). | **Narrator:** "One in five US health claims is denied. Fewer than one percent are appealed — the letter is unreadable, the rights are unknown, the deadline is invisible. Overturn already fixed that on a screen. This is Overturn as a conversation: one question at a time, every fact read back, nothing done without a yes." |
| **0:45–1:05** | Full audio back for **T8**. On-screen, the transcript bubble highlights the date and the source names as they are spoken (or a simple caption strip: *Mar 10, 2027 · 140 days · ACA appeal rules · CA grievance → DMHC · IMR free*). | **Assistant (T8):** "Here's where you stand. Your first deadline is March 10th, 2027 — 140 days from today — to file an internal appeal with the plan, under the federal ACA appeal rules. You also have the right to a free copy of your claim file… And in California, you file a grievance with the plan first; if it isn't resolved in 30 days, you can go to the Department of Managed Health Care… Want to hear more, or shall I draft the appeal letter?" |
| **1:05–1:25** | T9–T11 at normal speed. Show the two explicit confirmations clearly; the masked email is visible in the bubble. Cut to **inbox PiP** the moment "Sent" is spoken: email with two PDF attachments; open the letter for 2 s, then the summary page with the source links. | **User:** "Draft the letter." **Assistant (T9):** "…Shall I go ahead?" **User:** "Yes." **Assistant (T10):** "Done — two pages, four blanks… Shall I send it to your email ending in w-dot-gmail-dot-com?" **User:** "Yes, send it." **Assistant (T11):** "Sent. The email has the letter, your deadlines with links, and what to attach…" |
| **1:25–1:35** | Hold on T12 closing bubble; then the assistant goes idle. | **Assistant (T12):** "…California's Help Center at the Department of Managed Health Care is free; their number is in the email. I've kept nothing on my side." **Narrator:** "Twelve turns. Under four minutes. Every deadline and every protection came from a sourced rules dataset — the model never decided what the law says." |
| **1:35–1:55** | **No-document path**, sped up 1.5× with captions: "No, I can't find it" → Texas → employer → no prior authorization → "about two weeks ago" → deadline spoken as approximate. | **Narrator:** "Lost the letter? Five spoken answers give the federal and state baseline, an approximate deadline, and a letter with blanks to fill later. This path needs no document reading at all — it works even if the model is down." *(assistant audio under, ducked)* |
| **1:55–2:15** | **MCP Inspector** full screen: connect to the public AgentCore URL with a bearer; tool list with descriptions; call `overturn_draft_letter` without `confirmed` → the `needs_confirmation` result with the question text; then a 401 in the network tab when the bearer is removed. | **Narrator:** "Under the hood is a self-hosted MCP server — spec 2025-11-25, Streamable HTTP, OAuth 2.1 with PKCE through Amazon Cognito, hosted on Bedrock AgentCore Runtime. Any assistant can drive it. Consequential tools refuse to act without a confirmation and hand back the exact question to ask. Alexa+ access is partner-only today; this server is built to its published requirements, so connecting it is configuration, not code." |
| **2:15–2:30** | Architecture card (one slide): *Alexa+ (future) / simulated Alexa+ web app → MCP server on AgentCore → engine (model reads · code decides) → SES email · Polly · Cognito*. Then the dataset repo README for 2 s. | **Narrator:** "The state appeal rules — deadlines, external review routes, regulators, every one with its primary source and a last-verified date — are published as a separate open-source dataset under MIT, for anyone building in this space." |
| **2:30–2:40** | "Built during the hackathon" card: two columns — *Before (LexHack, Sept)*: web app, engine, rules · *During (Sept 28–Oct 23)*: MCP server, voice simulator, companion, Cognito/AgentCore/SES/Polly, provider abstraction, open dataset. Friction-log icon. | **Narrator:** "What existed before: the web app and its engine. What was built in the window: everything you just heard. Solo, with the friction log to prove it." |
| **2:40–2:48** | End card: repo URL · dataset URL · live simulator URL · *Information, not legal advice.* | **Narrator:** "Overturn. Say what happened. Know the deadline. Answer back." |

## Fallbacks decided in advance

| If… | Then… |
|---|---|
| SES fails on the day | Keep the take: the assistant says the email failed and reads the download link; cut to the companion page download instead of the inbox. It demonstrates FR-021 and costs nothing. |
| Speech recognition mishears you | Keep it if the assistant recovers in one re-prompt (that *is* the design); otherwise redo the turn — turns are independent, edits are invisible. |
| AgentCore URL is down | Inspector segment against the App Runner fallback or local server with `MCP_PUBLIC_URL` hidden; say "self-hosted" without naming the host in that take. |
| Over 3:00 | Cut in this order: architecture card (−10 s) → no-document path shortened to the deadline line (−10 s) → T12 closing (−5 s). Never cut 0:00–0:30 or the Inspector's `needs_confirmation`. |

## Recording checklist

- Deployed simulator (Vercel URL), Cognito account already linked, SES recipient verified, Polly enabled; Chrome, 100 % zoom, no extensions, notifications off, light mode.
- Fresh simulator session (reset) so the case code is new; `/companion` open on the phone beforehand.
- Read the user lines flat and short; leave 0.5 s after each assistant turn before answering (the mic reopens after TTS).
- Capture at 60 fps; screen + system audio (Polly) on one track, mic on a second track; narrator recorded separately and aligned.
- Inspector: pre-fill the URL and bearer; have the `overturn_draft_letter` call ready with `{ "code": "…" }` only.
- Inbox: a clean demo mailbox, previews off, so the two attachments are the only thing on screen.
- Export MP4 H.264 1080p ≤ 3:00; upload **public** on YouTube (rule), English title and description with the repo link; test the link logged out.

## Cards (text to prepare, `docs/video/cards/`)

1. Lower-third 0:30: `Overturn · Alexa+ track · self-hosted MCP server`
2. Caption strip 0:45: `Mar 10, 2027 · 140 days left · federal ACA appeal rules · CA grievance → DMHC · IMR free`
3. Architecture card 2:15 (from `infra/README.md` diagram)
4. Built-during card 2:30 (two columns, from README section)
5. End card 2:40 (three URLs + disclaimer)

## Screenshots for the Devpost gallery (same session)

1. `/sim` mid-conversation with the read-back bubble
2. Phone companion page with the code entered
3. T8 rights bubble with the caption strip
4. Inspector tool list
5. Inspector `needs_confirmation` result
6. Inbox with the two attachments
7. Architecture card
